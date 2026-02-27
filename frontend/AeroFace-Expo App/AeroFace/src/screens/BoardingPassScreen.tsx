import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  Image,
  ActivityIndicator,
  Alert,
  Platform,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { File as ExpoFile } from 'expo-file-system';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../App';
import { supabase } from '../lib/supabase';

const { width: SCREEN_W } = Dimensions.get('window');

// ═══════════════════════════════════════════════════════════════════
//  Types
// ═══════════════════════════════════════════════════════════════════

interface BoardingPassData {
  id?: string;
  passenger_name: string | null;
  flight_number: string | null;
  airline: string | null;
  departure_airport_code: string | null;
  departure_airport_name: string | null;
  arrival_airport_code: string | null;
  arrival_airport_name: string | null;
  departure_date: string | null;
  departure_time: string | null;
  boarding_time: string | null;
  gate: string | null;
  seat: string | null;
  booking_reference: string | null;
  travel_class: string | null;
  sequence_number: string | null;
  extraction_confidence: number;
  status: string;
  created_at?: string;
}

type Step = 'upload' | 'scanning' | 'result' | 'history';

// ═══════════════════════════════════════════════════════════════════
//  Constants
// ═══════════════════════════════════════════════════════════════════

const SUPABASE_URL = 'https://fksgblzszxwmoqbmzbsj.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZrc2dibHpzenh3bW9xYm16YnNqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxNzY5NjksImV4cCI6MjA4Nzc1Mjk2OX0.aAh2Tj8CMiTjXpawt4afEA6YTCQevCV9SFhKJPlNZ-I';
const EDGE_FN = SUPABASE_URL + '/functions/v1/scan-boarding-pass';

// ═══════════════════════════════════════════════════════════════════
//  Component
// ═══════════════════════════════════════════════════════════════════

export default function BoardingPassScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [step, setStep] = useState<Step>('upload');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<BoardingPassData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<BoardingPassData[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // ── Load history on mount ────────────────────────────────────
  useEffect(() => {
    fetchHistory();
  }, []);

  // ── Get auth token ───────────────────────────────────────────
  async function getAuthToken(): Promise<string | null> {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token || null;
  }

  // ── Fetch scan history ───────────────────────────────────────
  async function fetchHistory() {
    setLoadingHistory(true);
    try {
      const token = await getAuthToken();
      if (!token) return;

      const res = await fetch(EDGE_FN + '?action=list', {
        method: 'GET',
        headers: {
          Authorization: 'Bearer ' + token,
          apikey: SUPABASE_ANON_KEY,
        },
      });

      const data = await res.json();
      if (data.success) {
        setHistory(data.boarding_passes || []);
      }
    } catch (e) {
      console.error('[history]', e);
    } finally {
      setLoadingHistory(false);
    }
  }

  // ── Pick Image ───────────────────────────────────────────────
  async function pickImage(source: 'camera' | 'gallery') {
    try {
      let result;

      if (source === 'camera') {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission Required', 'Camera access is needed to scan boarding passes.');
          return;
        }
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ['images'],
          quality: 0.8,
          base64: true,
        });
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission Required', 'Gallery access is needed to upload boarding passes.');
          return;
        }
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          quality: 0.8,
          base64: true,
        });
      }

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        setImageUri(asset.uri);
        setError(null);

        // Auto-scan immediately
        if (asset.base64) {
          scanBoardingPass(asset.base64, false);
        }
      }
    } catch (e: any) {
      console.error('[pickImage]', e);
      Alert.alert('Error', 'Could not access ' + source);
    }
  }

  // ── Pick PDF ─────────────────────────────────────────────────
  async function pickPdf() {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets?.[0]) {
        const asset = result.assets[0];
        setImageUri(null); // PDFs don't have image preview
        setError(null);

        // Read file as base64
        const file = new ExpoFile(asset.uri);
        const base64 = await file.base64();

        if (base64) {
          scanBoardingPass(base64, true);
        } else {
          setError('Could not read PDF file');
        }
      }
    } catch (e: any) {
      console.error('[pickPdf]', e);
      Alert.alert('Error', 'Could not read the PDF file');
    }
  }

  // ── Scan Boarding Pass ───────────────────────────────────────
  async function scanBoardingPass(base64: string, isPdf: boolean = false) {
    setStep('scanning');
    setScanning(true);
    setError(null);

    try {
      const token = await getAuthToken();
      if (!token) {
        throw new Error('Please sign in to scan boarding passes');
      }

      const payload = isPdf
        ? { pdf_base64: base64 }
        : { image_base64: base64 };

      const res = await fetch(EDGE_FN, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + token,
          apikey: SUPABASE_ANON_KEY,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (data.success && data.boarding_pass) {
        setResult(data.boarding_pass);
        setStep('result');
        // Refresh history
        fetchHistory();
      } else {
        throw new Error(data.error || 'Could not extract boarding pass data');
      }
    } catch (e: any) {
      console.error('[scan]', e);
      setError(e.message || 'Scan failed');
      setStep('upload');
    } finally {
      setScanning(false);
    }
  }

  // ── Reset to upload ──────────────────────────────────────────
  function resetScan() {
    setStep('upload');
    setImageUri(null);
    setResult(null);
    setError(null);
  }

  // ── Navigate to lounges ──────────────────────────────────────
  function findLounges() {
    if (result?.departure_airport_code) {
      navigation.navigate('Dashboard', {
        airportCode: result.departure_airport_code,
      });
    }
  }

  // ── Format date for display ──────────────────────────────────
  function formatDate(dateStr: string | null): string {
    if (!dateStr) return '--';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch {
      return dateStr;
    }
  }

  // ═══════════════════════════════════════════════════════════════
  //  Render: Upload Step
  // ═══════════════════════════════════════════════════════════════

  function renderUpload() {
    return (
      <View style={s.stepContainer}>
        {/* Upload Area */}
        <View style={s.uploadArea}>
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={s.previewImage} resizeMode="contain" />
          ) : (
            <View style={s.uploadPlaceholder}>
              <View style={s.uploadIconCircle}>
                <Ionicons name="scan-outline" size={40} color="#2563EB" />
              </View>
              <Text style={s.uploadTitle}>Scan Boarding Pass</Text>
              <Text style={s.uploadSubtitle}>
                Take a photo, upload from gallery, or select a PDF to extract flight details
              </Text>
            </View>
          )}
        </View>

        {/* Action Buttons */}
        <View style={s.uploadActions}>
          <Pressable style={s.uploadBtn} onPress={() => pickImage('camera')}>
            <Ionicons name="camera-outline" size={22} color="#fff" />
            <Text style={s.uploadBtnText}>Camera</Text>
          </Pressable>
          <Pressable style={[s.uploadBtn, s.uploadBtnSecondary]} onPress={() => pickImage('gallery')}>
            <Ionicons name="images-outline" size={22} color="#2563EB" />
            <Text style={[s.uploadBtnText, s.uploadBtnTextSecondary]}>Gallery</Text>
          </Pressable>
        </View>

        {/* PDF Upload */}
        <Pressable style={s.pdfBtn} onPress={pickPdf}>
          <Ionicons name="document-text-outline" size={20} color="#2563EB" />
          <Text style={s.pdfBtnText}>Upload PDF Boarding Pass</Text>
        </Pressable>

        {/* Error */}
        {error && (
          <View style={s.errorBox}>
            <Ionicons name="alert-circle-outline" size={18} color="#DC2626" />
            <Text style={s.errorText}>{error}</Text>
          </View>
        )}

        {/* History Section */}
        {history.length > 0 && (
          <View style={s.historySection}>
            <Text style={s.sectionTitle}>Recent Scans</Text>
            {history.map((bp) => renderHistoryCard(bp))}
          </View>
        )}

        {loadingHistory && (
          <ActivityIndicator size="small" color="#2563EB" style={{ marginTop: 20 }} />
        )}
      </View>
    );
  }

  // ═══════════════════════════════════════════════════════════════
  //  Render: Scanning Animation
  // ═══════════════════════════════════════════════════════════════

  function renderScanning() {
    return (
      <View style={s.scanningContainer}>
        {imageUri && (
          <Image source={{ uri: imageUri }} style={s.scanningImage} resizeMode="contain" />
        )}
        {!imageUri && (
          <View style={s.pdfScanIconWrap}>
            <Ionicons name="document-text-outline" size={56} color="#2563EB" />
          </View>
        )}
        <View style={s.scanningOverlay}>
          <ActivityIndicator size="large" color="#2563EB" />
          <Text style={s.scanningTitle}>Scanning Boarding Pass</Text>
          <Text style={s.scanningSubtitle}>
            Extracting flight details using OCR...
          </Text>
        </View>
      </View>
    );
  }

  // ═══════════════════════════════════════════════════════════════
  //  Render: Result Card (Boarding Pass Style)
  // ═══════════════════════════════════════════════════════════════

  function renderResult() {
    if (!result) return null;

    const confidence = Math.round((result.extraction_confidence || 0) * 100);

    return (
      <View style={s.stepContainer}>
        {/* Success Header */}
        <View style={s.successHeader}>
          <View style={s.successIconCircle}>
            <Ionicons name="checkmark-circle" size={28} color="#059669" />
          </View>
          <Text style={s.successTitle}>Scan Complete</Text>
          <Text style={s.successSubtitle}>
            Confidence: {confidence}%
          </Text>
        </View>

        {/* Boarding Pass Card */}
        <View style={s.bpCard}>
          {/* Airline Header */}
          <View style={s.bpHeader}>
            <View>
              <Text style={s.bpAirline}>{result.airline || 'Airline'}</Text>
              <Text style={s.bpFlightNum}>{result.flight_number || '--'}</Text>
            </View>
            {result.travel_class && (
              <View style={s.classBadge}>
                <Text style={s.classBadgeText}>{result.travel_class}</Text>
              </View>
            )}
          </View>

          {/* Route */}
          <View style={s.routeRow}>
            <View style={s.routeEnd}>
              <Text style={s.routeCode}>{result.departure_airport_code || '---'}</Text>
              <Text style={s.routeName} numberOfLines={1}>
                {result.departure_airport_name || 'Departure'}
              </Text>
            </View>
            <View style={s.routeMiddle}>
              <View style={s.routeLine} />
              <Ionicons name="airplane" size={20} color="#2563EB" />
              <View style={s.routeLine} />
            </View>
            <View style={[s.routeEnd, { alignItems: 'flex-end' }]}>
              <Text style={s.routeCode}>{result.arrival_airport_code || '---'}</Text>
              <Text style={s.routeName} numberOfLines={1}>
                {result.arrival_airport_name || 'Arrival'}
              </Text>
            </View>
          </View>

          {/* Divider */}
          <View style={s.bpDivider}>
            <View style={s.bpDividerCircleLeft} />
            <View style={s.bpDividerLine} />
            <View style={s.bpDividerCircleRight} />
          </View>

          {/* Passenger Name */}
          {result.passenger_name && (
            <View style={s.bpFieldRow}>
              <View style={s.bpField}>
                <Text style={s.bpFieldLabel}>PASSENGER</Text>
                <Text style={s.bpFieldValue}>{result.passenger_name}</Text>
              </View>
            </View>
          )}

          {/* Details Grid */}
          <View style={s.bpGrid}>
            <View style={s.bpField}>
              <Text style={s.bpFieldLabel}>DATE</Text>
              <Text style={s.bpFieldValue}>{formatDate(result.departure_date)}</Text>
            </View>
            <View style={s.bpField}>
              <Text style={s.bpFieldLabel}>DEPARTURE</Text>
              <Text style={s.bpFieldValue}>{result.departure_time || '--'}</Text>
            </View>
            <View style={s.bpField}>
              <Text style={s.bpFieldLabel}>BOARDING</Text>
              <Text style={s.bpFieldValue}>{result.boarding_time || '--'}</Text>
            </View>
          </View>

          <View style={s.bpGrid}>
            <View style={s.bpField}>
              <Text style={s.bpFieldLabel}>GATE</Text>
              <Text style={s.bpFieldValue}>{result.gate || '--'}</Text>
            </View>
            <View style={s.bpField}>
              <Text style={s.bpFieldLabel}>SEAT</Text>
              <Text style={s.bpFieldValue}>{result.seat || '--'}</Text>
            </View>
            <View style={s.bpField}>
              <Text style={s.bpFieldLabel}>PNR</Text>
              <Text style={s.bpFieldValue}>{result.booking_reference || '--'}</Text>
            </View>
          </View>
          {result.sequence_number && (
            <View style={s.bpFieldRow}>
              <View style={s.bpField}>
                <Text style={s.bpFieldLabel}>SEQUENCE</Text>
                <Text style={s.bpFieldValue}>{result.sequence_number}</Text>
              </View>
            </View>
          )}
        </View>

        {/* Action Buttons */}
        <View style={s.resultActions}>
          {result.departure_airport_code && (
            <Pressable style={s.findLoungesBtn} onPress={findLounges}>
              <Ionicons name="business-outline" size={20} color="#fff" />
              <Text style={s.findLoungesBtnText}>
                Find Lounges at {result.departure_airport_code}
              </Text>
            </Pressable>
          )}
          <Pressable style={s.scanAgainBtn} onPress={resetScan}>
            <Ionicons name="scan-outline" size={20} color="#2563EB" />
            <Text style={s.scanAgainBtnText}>Scan Another</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // ═══════════════════════════════════════════════════════════════
  //  Render: History Card
  // ═══════════════════════════════════════════════════════════════

  function renderHistoryCard(bp: BoardingPassData) {
    return (
      <Pressable
        key={bp.id}
        style={s.historyCard}
        onPress={() => {
          setResult(bp);
          setStep('result');
        }}
      >
        <View style={s.historyCardLeft}>
          <View style={s.historyRoute}>
            <Text style={s.historyCode}>{bp.departure_airport_code || '---'}</Text>
            <Ionicons name="arrow-forward" size={14} color="#94A3B8" />
            <Text style={s.historyCode}>{bp.arrival_airport_code || '---'}</Text>
          </View>
          <Text style={s.historyFlight}>
            {bp.airline || ''} {bp.flight_number || ''}
          </Text>
          <Text style={s.historyDate}>{formatDate(bp.departure_date)}</Text>
        </View>
        <View style={s.historyCardRight}>
          {bp.seat && (
            <View style={s.historySeatBadge}>
              <Text style={s.historySeatText}>{bp.seat}</Text>
            </View>
          )}
          <Ionicons name="chevron-forward" size={18} color="#CBD5E1" />
        </View>
      </Pressable>
    );
  }

  // ═══════════════════════════════════════════════════════════════
  //  Main Render
  // ═══════════════════════════════════════════════════════════════

  return (
    <View style={s.container}>
      <ScrollView
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={s.header}>
          <Pressable style={s.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#1E293B" />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={s.headerLabel}>AEROFACE</Text>
            <Text style={s.headerTitle}>Boarding Pass Scanner</Text>
          </View>
        </View>

        {/* Step Content */}
        {step === 'upload' && renderUpload()}
        {step === 'scanning' && renderScanning()}
        {step === 'result' && renderResult()}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════
//  Styles — Classic White Theme
// ═══════════════════════════════════════════════════════════════════

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  scrollContent: {
    paddingTop: Platform.OS === 'ios' ? 60 : 50,
    paddingHorizontal: 20,
  },

  // Header
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 24, gap: 12 },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8 },
      android: { elevation: 2 },
    }),
  },
  headerLabel: {
    fontFamily: 'SpaceGrotesk_400Regular',
    fontSize: 11,
    color: '#2563EB',
    letterSpacing: 3,
  },
  headerTitle: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 22,
    color: '#1E293B',
    marginTop: 2,
  },

  // Step container
  stepContainer: {},

  // Upload Area
  uploadArea: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
    overflow: 'hidden',
    minHeight: 260,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  uploadPlaceholder: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 24,
  },
  uploadIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  uploadTitle: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 20,
    color: '#1E293B',
    marginBottom: 8,
  },
  uploadSubtitle: {
    fontFamily: 'SpaceGrotesk_400Regular',
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 20,
  },
  previewImage: {
    width: '100%',
    height: 280,
  },

  // Upload Actions
  uploadActions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  uploadBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#2563EB',
    paddingVertical: 14,
    borderRadius: 14,
    ...Platform.select({
      ios: { shadowColor: '#2563EB', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 },
      android: { elevation: 4 },
    }),
  },
  uploadBtnSecondary: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    shadowColor: '#000',
    shadowOpacity: 0.06,
  },
  uploadBtnText: {
    fontFamily: 'SpaceGrotesk_500Medium',
    fontSize: 15,
    color: '#fff',
  },
  uploadBtnTextSecondary: {
    color: '#2563EB',
  },

  // PDF Upload
  pdfBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    paddingVertical: 13,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4 },
      android: { elevation: 1 },
    }),
  },
  pdfBtnText: {
    fontFamily: 'SpaceGrotesk_500Medium',
    fontSize: 14,
    color: '#2563EB',
  },

  // Error
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  errorText: {
    fontFamily: 'SpaceGrotesk_400Regular',
    fontSize: 13,
    color: '#DC2626',
    flex: 1,
  },

  // Scanning
  scanningContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 400,
  },
  scanningImage: {
    width: SCREEN_W - 80,
    height: 240,
    borderRadius: 16,
    marginBottom: 24,
    opacity: 0.6,
  },
  pdfScanIconWrap: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  scanningOverlay: {
    alignItems: 'center',
    gap: 12,
  },
  scanningTitle: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 18,
    color: '#1E293B',
    marginTop: 8,
  },
  scanningSubtitle: {
    fontFamily: 'SpaceGrotesk_400Regular',
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
  },

  // Success Header
  successHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  successIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  successTitle: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 20,
    color: '#059669',
  },
  successSubtitle: {
    fontFamily: 'SpaceGrotesk_400Regular',
    fontSize: 13,
    color: '#94A3B8',
    marginTop: 4,
  },

  // Boarding Pass Card
  bpCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 16 },
      android: { elevation: 4 },
    }),
  },

  // BP Header
  bpHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  bpAirline: {
    fontFamily: 'SpaceGrotesk_500Medium',
    fontSize: 14,
    color: '#64748B',
  },
  bpFlightNum: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 22,
    color: '#1E293B',
    marginTop: 2,
  },
  classBadge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  classBadgeText: {
    fontFamily: 'SpaceGrotesk_500Medium',
    fontSize: 12,
    color: '#2563EB',
  },

  // Route
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  routeEnd: {
    flex: 1,
  },
  routeMiddle: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    gap: 6,
  },
  routeLine: {
    width: 24,
    height: 1,
    backgroundColor: '#CBD5E1',
  },
  routeCode: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 28,
    color: '#1E293B',
  },
  routeName: {
    fontFamily: 'SpaceGrotesk_400Regular',
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },

  // Divider
  bpDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    marginHorizontal: -20,
  },
  bpDividerCircleLeft: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    marginLeft: -8,
  },
  bpDividerLine: {
    flex: 1,
    height: 1,
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  bpDividerCircleRight: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    marginRight: -8,
  },

  // BP Fields
  bpFieldRow: {
    marginBottom: 12,
  },
  bpGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  bpField: {
    flex: 1,
  },
  bpFieldLabel: {
    fontFamily: 'SpaceGrotesk_400Regular',
    fontSize: 10,
    color: '#94A3B8',
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  bpFieldValue: {
    fontFamily: 'SpaceGrotesk_500Medium',
    fontSize: 15,
    color: '#1E293B',
  },

  // Result Actions
  resultActions: {
    gap: 12,
  },
  findLoungesBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#2563EB',
    paddingVertical: 16,
    borderRadius: 14,
    ...Platform.select({
      ios: { shadowColor: '#2563EB', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 },
      android: { elevation: 4 },
    }),
  },
  findLoungesBtnText: {
    fontFamily: 'SpaceGrotesk_500Medium',
    fontSize: 16,
    color: '#fff',
  },
  scanAgainBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  scanAgainBtnText: {
    fontFamily: 'SpaceGrotesk_500Medium',
    fontSize: 15,
    color: '#2563EB',
  },

  // Section Title
  sectionTitle: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 18,
    color: '#1E293B',
    marginBottom: 12,
  },

  // History
  historySection: {
    marginTop: 8,
  },
  historyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4 },
      android: { elevation: 1 },
    }),
  },
  historyCardLeft: {
    flex: 1,
  },
  historyRoute: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  historyCode: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 16,
    color: '#1E293B',
  },
  historyFlight: {
    fontFamily: 'SpaceGrotesk_400Regular',
    fontSize: 12,
    color: '#64748B',
  },
  historyDate: {
    fontFamily: 'SpaceGrotesk_400Regular',
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  historyCardRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  historySeatBadge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  historySeatText: {
    fontFamily: 'SpaceGrotesk_500Medium',
    fontSize: 13,
    color: '#2563EB',
  },
});
