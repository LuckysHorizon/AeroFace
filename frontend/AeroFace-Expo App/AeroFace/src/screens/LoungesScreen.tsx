import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  Modal,
  FlatList,
  Platform,
  Image,
  Dimensions,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import {
  LoungeData,
  cacheKey,
  getCached,
  getCachedOrFetch,
  clearCache,
  AUTO_LOCATION_KEY,
} from '../lib/loungeCache';

const { width: SCREEN_W } = Dimensions.get('window');

// ═══════════════════════════════════════════════════════════════════
//  Types
// ═══════════════════════════════════════════════════════════════════

interface Airport {
  code: string;
  city: string;
  state: string;
  name: string;
  label: string;
  loungeCount: number;
  distance: number | null;
}

interface Lounge {
  id: string;
  name: string;
  airport_name: string;
  airport_code: string;
  terminal: string;
  latitude: number;
  longitude: number;
  address: string;
  rating: number;
  user_ratings_total: number;
  google_place_id: string;
  distance: number;
  opening_hours: string;
  is_open: boolean | null;
  access_info: string;
  photo_url: string | null;
  photo_ref: string | null;
  amenities: string[];
  phone?: string | null;
  website?: string | null;
  maps_url?: string | null;
  description?: string | null;
  top_review?: string | null;
  price_level?: number | null;
  business_status?: string;
}

// ═══════════════════════════════════════════════════════════════════
//  Constants
// ═══════════════════════════════════════════════════════════════════

const SUPABASE_URL = 'https://fksgblzszxwmoqbmzbsj.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZrc2dibHpzenh3bW9xYm16YnNqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxNzY5NjksImV4cCI6MjA4Nzc1Mjk2OX0.aAh2Tj8CMiTjXpawt4afEA6YTCQevCV9SFhKJPlNZ-I';
const EDGE_FN = SUPABASE_URL + '/functions/v1/fetch-lounges';

const PLACEHOLDER_IMG = 'https://images.unsplash.com/photo-1540339832862-474599807836?w=800&q=80';

// ═══════════════════════════════════════════════════════════════════
//  Component
// ═══════════════════════════════════════════════════════════════════

interface LoungesScreenProps {
  initialAirportCode?: string;
}

export default function LoungesScreen({ initialAirportCode }: LoungesScreenProps = {}) {
  const [lounges, setLounges] = useState<Lounge[]>([]);
  const [airports, setAirports] = useState<Airport[]>([]);
  const [selectedAirport, setSelectedAirport] = useState<string | null>(null);
  const [airportCity, setAirportCity] = useState('');
  const [airportName, setAirportName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [dataSource, setDataSource] = useState<string>('');
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const hasInitialized = useRef(false);

  // ── Helper: apply fetched data to state ──────────────────────
  function applyData(data: LoungeData) {
    setLounges(data.lounges);
    setAirports(data.airports);
    setSelectedAirport(data.selectedAirport);
    setAirportCity(data.airportCity);
    setAirportName(data.airportName);
    setDataSource(data.dataSource);
  }

  // ── Init ─────────────────────────────────────────────────────
  useEffect(() => {
    if (initialAirportCode) {
      // If we received an airport from boarding pass scan, fetch for that airport
      fetchLounges(null, null, initialAirportCode);
    } else {
      // Skip if we already initialized (component stayed mounted across tab switches)
      if (hasInitialized.current) return;
      hasInitialized.current = true;
      initAndFetch();
    }
  }, [initialAirportCode]);

  async function initAndFetch() {
    setError(null);

    // Check cache first — restore instantly without loading spinner
    const key = cacheKey(null);
    const cached = getCached(key);
    if (cached) {
      applyData(cached);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        const coords = { lat: loc.coords.latitude, lng: loc.coords.longitude };
        setUserCoords(coords);
        await fetchLounges(coords.lat, coords.lng);
      } else {
        await fetchLounges(null, null);
      }
    } catch (e: any) {
      console.error('[init]', e);
      await fetchLounges(null, null);
    }
  }

  // ── Fetch (uses cache layer) ────────────────────────────────
  async function fetchLounges(lat: number | null, lng: number | null, airportCode?: string) {
    const key = cacheKey(airportCode);
    try {
      setError(null);
      // Only show loading if we have no data to display
      if (lounges.length === 0) setLoading(true);

      const data = await getCachedOrFetch(key, async () => {
        const body: any = {};
        if (lat != null && lng != null) { body.latitude = lat; body.longitude = lng; }
        if (airportCode) body.airport_code = airportCode;

        const res = await fetch(EDGE_FN, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer ' + SUPABASE_ANON_KEY,
            apikey: SUPABASE_ANON_KEY,
          },
          body: JSON.stringify(body),
        });

        if (!res.ok) throw new Error('Server error (' + res.status + ')');
        const json = await res.json();

        if (!json.success) {
          throw new Error(json.error || 'Failed to load lounges');
        }

        return {
          lounges: json.lounges || [],
          airports: json.airports || [],
          selectedAirport: json.selected_airport || null,
          airportCity: json.airport_city || '',
          airportName: json.airport_name || '',
          dataSource: json.source || 'mock_data',
        } as LoungeData;
      });

      applyData(data);
    } catch (e: any) {
      console.error('[fetch]', e);
      setError(e.message || 'Could not load lounges');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  // ── Handlers ─────────────────────────────────────────────────
  const onSelectAirport = useCallback((code: string) => {
    setShowDropdown(false);
    setSelectedAirport(code);
    fetchLounges(userCoords?.lat ?? null, userCoords?.lng ?? null, code);
  }, [userCoords]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    // Clear cache so pull-to-refresh always gets fresh data
    clearCache(cacheKey(selectedAirport));
    if (selectedAirport) {
      fetchLounges(userCoords?.lat ?? null, userCoords?.lng ?? null, selectedAirport);
    } else {
      hasInitialized.current = false;
      initAndFetch();
    }
  }, [userCoords, selectedAirport]);

  function toggleExpand(id: string) {
    setExpandedCard(expandedCard === id ? null : id);
  }

  // ═══════════════════════════════════════════════════════════════
  //  Render Helpers
  // ═══════════════════════════════════════════════════════════════

  // ── Airport Item ─────────────────────────────────────────────
  function renderAirportItem({ item }: { item: Airport }) {
    const isSelected = item.code === selectedAirport;
    return (
      <Pressable
        style={[s.airportItem, isSelected && s.airportItemActive]}
        onPress={() => onSelectAirport(item.code)}
      >
        <View style={s.airportBadge}>
          <Text style={s.airportBadgeText}>{item.code}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.airportCity}>{item.city}</Text>
          <Text style={s.airportState}>{item.state}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={s.loungeCount}>{item.loungeCount} lounge{item.loungeCount !== 1 ? 's' : ''}</Text>
          {item.distance != null && (
            <Text style={s.airportDist}>{item.distance} km</Text>
          )}
        </View>
      </Pressable>
    );
  }

  // ── Open/Closed Badge ────────────────────────────────────────
  function StatusBadge({ isOpen }: { isOpen: boolean | null }) {
    if (isOpen === null) return null;
    return (
      <View style={[s.statusBadge, isOpen ? s.statusOpen : s.statusClosed]}>
        <View style={[s.statusDot, { backgroundColor: isOpen ? '#059669' : '#DC2626' }]} />
        <Text style={[s.statusText, { color: isOpen ? '#fff' : '#fff' }]}>
          {isOpen ? 'Open Now' : 'Closed'}
        </Text>
      </View>
    );
  }

  // ── Rating Stars ─────────────────────────────────────────────
  function RatingDisplay({ rating, total }: { rating: number; total: number }) {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      if (i <= Math.floor(rating)) {
        stars.push(<Ionicons key={i} name="star" size={14} color="#F59E0B" />);
      } else if (i - 0.5 <= rating) {
        stars.push(<Ionicons key={i} name="star-half" size={14} color="#F59E0B" />);
      } else {
        stars.push(<Ionicons key={i} name="star-outline" size={14} color="#D1D5DB" />);
      }
    }
    return (
      <View style={s.ratingRow}>
        {stars}
        <Text style={s.ratingNum}>{rating.toFixed(1)}</Text>
        {total > 0 && <Text style={s.ratingCount}>({total})</Text>}
      </View>
    );
  }

  // ── Lounge Card ──────────────────────────────────────────────
  function renderLounge(lounge: Lounge, index: number) {
    const expanded = expandedCard === lounge.id;
    const img = lounge.photo_url || PLACEHOLDER_IMG;
    const hasDetails = lounge.phone || lounge.website || lounge.description || lounge.top_review;

    return (
      <View key={lounge.id} style={s.card}>
        {/* Hero Image */}
        <View style={s.cardImageWrap}>
          <Image source={{ uri: img }} style={s.cardImage} resizeMode="cover" />
          <View style={s.cardImageOverlay}>
            <StatusBadge isOpen={lounge.is_open} />
            {lounge.distance > 0 && (
              <View style={s.distBadge}>
                <Ionicons name="navigate-outline" size={12} color="#fff" />
                <Text style={s.distBadgeText}>{lounge.distance} km</Text>
              </View>
            )}
          </View>
        </View>

        {/* Card Body */}
        <View style={s.cardBody}>
          {/* Title + Terminal */}
          <Text style={s.cardTitle} numberOfLines={2}>{lounge.name}</Text>
          {lounge.terminal ? (
            <View style={s.terminalRow}>
              <Ionicons name="business-outline" size={13} color="#94A3B8" />
              <Text style={s.terminalText}>{lounge.terminal}</Text>
              <Text style={s.terminalDot}>{' \u2022 '}</Text>
              <Text style={s.terminalText}>{lounge.airport_code}</Text>
            </View>
          ) : null}

          {/* Rating + Hours */}
          <View style={s.metaRow}>
            <RatingDisplay rating={lounge.rating} total={lounge.user_ratings_total} />
            {lounge.opening_hours ? (
              <View style={s.hoursChip}>
                <Ionicons name="time-outline" size={12} color="#64748B" />
                <Text style={s.hoursText}>{lounge.opening_hours}</Text>
              </View>
            ) : null}
          </View>

          {/* Address */}
          <View style={s.addressRow}>
            <Ionicons name="location-outline" size={14} color="#94A3B8" />
            <Text style={s.addressText} numberOfLines={2}>{lounge.address}</Text>
          </View>

          {/* Access */}
          {lounge.access_info ? (
            <View style={s.accessRow}>
              <Ionicons name="key-outline" size={14} color="#2563EB" />
              <Text style={s.accessText}>{lounge.access_info}</Text>
            </View>
          ) : null}

          {/* Amenities */}
          {lounge.amenities?.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.amenitiesScroll}>
              {lounge.amenities.map((a, i) => (
                <View key={i} style={s.amenityChip}>
                  <Text style={s.amenityText}>{a}</Text>
                </View>
              ))}
            </ScrollView>
          )}

          {/* Description (from Place Details) */}
          {expanded && lounge.description ? (
            <Text style={s.descText}>{lounge.description}</Text>
          ) : null}

          {/* Top Review (from Place Details) */}
          {expanded && lounge.top_review ? (
            <View style={s.reviewBox}>
              <Ionicons name="chatbubble-outline" size={14} color="#94A3B8" />
              <Text style={s.reviewText} numberOfLines={3}>{lounge.top_review}</Text>
            </View>
          ) : null}

          {/* Action Buttons */}
          <View style={s.actionRow}>
            {hasDetails && (
              <Pressable style={s.actionBtn} onPress={() => toggleExpand(lounge.id)}>
                <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color="#2563EB" />
                <Text style={s.actionBtnText}>{expanded ? 'Less' : 'More'}</Text>
              </Pressable>
            )}
            {lounge.maps_url && (
              <Pressable style={s.actionBtn} onPress={() => Linking.openURL(lounge.maps_url!)}>
                <Ionicons name="map-outline" size={16} color="#2563EB" />
                <Text style={s.actionBtnText}>Maps</Text>
              </Pressable>
            )}
            {lounge.website && (
              <Pressable style={s.actionBtn} onPress={() => Linking.openURL(lounge.website!)}>
                <Ionicons name="globe-outline" size={16} color="#2563EB" />
                <Text style={s.actionBtnText}>Website</Text>
              </Pressable>
            )}
            {lounge.phone && (
              <Pressable style={s.actionBtn} onPress={() => Linking.openURL('tel:' + lounge.phone)}>
                <Ionicons name="call-outline" size={16} color="#2563EB" />
                <Text style={s.actionBtnText}>Call</Text>
              </Pressable>
            )}
          </View>
        </View>
      </View>
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
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#2563EB"
            colors={['#2563EB']}
          />
        }
      >
        {/* Header */}
        <View style={s.header}>
          <Text style={s.headerLabel}>AIRPORT LOUNGES</Text>
          <Text style={s.headerTitle}>Find Your Lounge</Text>
          {airportName ? (
            <Text style={s.headerSubtitle}>{airportName}</Text>
          ) : null}
        </View>

        {/* Airport Selector */}
        <Pressable style={s.selector} onPress={() => setShowDropdown(true)}>
          <View style={s.selectorContent}>
            <Ionicons name="airplane" size={20} color="#2563EB" />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={s.selectorLabel}>
                {selectedAirport ? airportCity + ' (' + selectedAirport + ')' : 'Select Airport'}
              </Text>
              {lounges.length > 0 && (
                <Text style={s.selectorSub}>
                  {lounges.length} lounge{lounges.length !== 1 ? 's' : ''} found
                </Text>
              )}
            </View>
            <Ionicons name="chevron-down" size={20} color="#94A3B8" />
          </View>
        </Pressable>

        {/* Location Indicator */}
        {userCoords && (
          <View style={s.locationRow}>
            <Ionicons name="location" size={14} color="#059669" />
            <Text style={s.locationText}>
              Location detected{selectedAirport ? ' \u2022 Nearest: ' + selectedAirport : ''}
            </Text>
          </View>
        )}

        {/* Source Badge */}
        {dataSource ? (
          <View style={[s.sourceBadge, dataSource === 'google_places' ? s.sourceGoogle : s.sourceMock]}>
            <Ionicons
              name={dataSource === 'google_places' ? 'globe-outline' : 'cube-outline'}
              size={14}
              color={dataSource === 'google_places' ? '#059669' : '#D97706'}
            />
            <Text style={[s.sourceText, { color: dataSource === 'google_places' ? '#059669' : '#D97706' }]}>
              {dataSource === 'google_places' ? 'Live from Google Maps' : 'Curated Data'}
            </Text>
          </View>
        ) : null}

        {/* Loading State */}
        {loading && (
          <View style={s.centerState}>
            <ActivityIndicator size="large" color="#2563EB" />
            <Text style={s.stateText}>Searching lounges...</Text>
          </View>
        )}

        {/* Error State */}
        {error && !loading && (
          <View style={s.centerState}>
            <Ionicons name="alert-circle-outline" size={48} color="#DC2626" />
            <Text style={s.stateText}>{error}</Text>
            <Pressable style={s.retryBtn} onPress={onRefresh}>
              <Text style={s.retryText}>Try Again</Text>
            </Pressable>
          </View>
        )}

        {/* Empty State */}
        {!loading && !error && lounges.length === 0 && (
          <View style={s.centerState}>
            <Ionicons name="search-outline" size={48} color="#CBD5E1" />
            <Text style={s.stateText}>No lounges found for this airport</Text>
          </View>
        )}

        {/* Lounge Cards */}
        {!loading && lounges.map((l, i) => renderLounge(l, i))}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Airport Modal */}
      <Modal visible={showDropdown} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <View style={s.modalContainer}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Select Airport</Text>
              <Pressable onPress={() => setShowDropdown(false)} style={s.modalClose}>
                <Ionicons name="close" size={24} color="#1E293B" />
              </Pressable>
            </View>
            <FlatList
              data={airports}
              keyExtractor={(a) => a.code}
              renderItem={renderAirportItem}
              contentContainerStyle={{ paddingBottom: 20 }}
              showsVerticalScrollIndicator={false}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════
//  Styles — Classic White Theme
// ═══════════════════════════════════════════════════════════════════

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  scrollContent: { paddingTop: Platform.OS === 'ios' ? 60 : 50, paddingHorizontal: 20 },

  // Header
  header: { marginBottom: 20 },
  headerLabel: { fontFamily: 'SpaceGrotesk_400Regular', fontSize: 12, color: '#2563EB', letterSpacing: 3, marginBottom: 4 },
  headerTitle: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 28, color: '#1E293B' },
  headerSubtitle: { fontFamily: 'SpaceGrotesk_400Regular', fontSize: 13, color: '#94A3B8', marginTop: 4 },

  // Selector
  selector: {
    marginBottom: 12, borderRadius: 16, overflow: 'hidden', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0',
    ...Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8 }, android: { elevation: 2 } })
  },
  selectorContent: { flexDirection: 'row', alignItems: 'center', padding: 16 },
  selectorLabel: { fontFamily: 'SpaceGrotesk_500Medium', fontSize: 16, color: '#1E293B' },
  selectorSub: { fontFamily: 'SpaceGrotesk_400Regular', fontSize: 12, color: '#94A3B8', marginTop: 2 },

  // Location
  locationRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 6 },
  locationText: { fontFamily: 'SpaceGrotesk_400Regular', fontSize: 12, color: '#64748B' },

  // Source Badge
  sourceBadge: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, marginBottom: 16, gap: 6 },
  sourceGoogle: { backgroundColor: '#ECFDF5', borderWidth: 1, borderColor: '#A7F3D0' },
  sourceMock: { backgroundColor: '#FFFBEB', borderWidth: 1, borderColor: '#FDE68A' },
  sourceText: { fontFamily: 'SpaceGrotesk_500Medium', fontSize: 12 },

  // Center States
  centerState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 12 },
  stateText: { fontFamily: 'SpaceGrotesk_400Regular', fontSize: 14, color: '#94A3B8', textAlign: 'center' },
  retryBtn: { backgroundColor: '#EFF6FF', paddingHorizontal: 24, paddingVertical: 10, borderRadius: 12, marginTop: 8, borderWidth: 1, borderColor: '#BFDBFE' },
  retryText: { fontFamily: 'SpaceGrotesk_500Medium', fontSize: 14, color: '#2563EB' },

  // Card
  card: {
    backgroundColor: '#FFFFFF', borderRadius: 20, overflow: 'hidden', marginBottom: 20, borderWidth: 1, borderColor: '#E2E8F0',
    ...Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12 }, android: { elevation: 3 } })
  },

  // Card Image
  cardImageWrap: { height: 180, position: 'relative' },
  cardImage: { width: '100%', height: '100%' },
  cardImageOverlay: { position: 'absolute', top: 12, left: 12, right: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },

  // Status Badge (on image — keep semi-transparent dark bg for contrast)
  statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, gap: 5 },
  statusOpen: { backgroundColor: 'rgba(5,150,105,0.85)' },
  statusClosed: { backgroundColor: 'rgba(220,38,38,0.85)' },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontFamily: 'SpaceGrotesk_500Medium', fontSize: 11, color: '#fff' },

  // Distance Badge (on image)
  distBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, gap: 4 },
  distBadgeText: { fontFamily: 'SpaceGrotesk_500Medium', fontSize: 11, color: '#fff' },

  // Card Body
  cardBody: { padding: 16 },
  cardTitle: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 18, color: '#1E293B', marginBottom: 4 },
  terminalRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 10 },
  terminalText: { fontFamily: 'SpaceGrotesk_400Regular', fontSize: 12, color: '#64748B' },
  terminalDot: { color: '#CBD5E1', fontSize: 12 },

  // Meta
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  ratingNum: { fontFamily: 'SpaceGrotesk_500Medium', fontSize: 13, color: '#D97706', marginLeft: 4 },
  ratingCount: { fontFamily: 'SpaceGrotesk_400Regular', fontSize: 12, color: '#94A3B8', marginLeft: 2 },
  hoursChip: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  hoursText: { fontFamily: 'SpaceGrotesk_400Regular', fontSize: 12, color: '#64748B' },

  // Address
  addressRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginBottom: 8 },
  addressText: { fontFamily: 'SpaceGrotesk_400Regular', fontSize: 12, color: '#64748B', flex: 1 },

  // Access
  accessRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  accessText: { fontFamily: 'SpaceGrotesk_400Regular', fontSize: 12, color: '#2563EB', flex: 1 },

  // Amenities
  amenitiesScroll: { marginBottom: 12 },
  amenityChip: { backgroundColor: '#F1F5F9', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, marginRight: 6, borderWidth: 1, borderColor: '#E2E8F0' },
  amenityText: { fontFamily: 'SpaceGrotesk_400Regular', fontSize: 11, color: '#475569' },

  // Description & Review
  descText: { fontFamily: 'SpaceGrotesk_400Regular', fontSize: 13, color: '#475569', marginBottom: 10, lineHeight: 20 },
  reviewBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: '#F8FAFC', padding: 12, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: '#E2E8F0' },
  reviewText: { fontFamily: 'SpaceGrotesk_400Regular', fontSize: 12, color: '#64748B', flex: 1, fontStyle: 'italic', lineHeight: 18 },

  // Action Row
  actionRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#EFF6FF', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: '#BFDBFE' },
  actionBtnText: { fontFamily: 'SpaceGrotesk_500Medium', fontSize: 12, color: '#2563EB' },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'flex-end' },
  modalContainer: { maxHeight: '75%', borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden', paddingTop: 20, paddingHorizontal: 20, backgroundColor: '#FFFFFF' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 20, color: '#1E293B' },
  modalClose: { padding: 4 },

  // Airport Items
  airportItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 12, borderRadius: 12, marginBottom: 6, gap: 12 },
  airportItemActive: { backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#BFDBFE' },
  airportBadge: { backgroundColor: '#EFF6FF', width: 48, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#BFDBFE' },
  airportBadgeText: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 13, color: '#2563EB' },
  airportCity: { fontFamily: 'SpaceGrotesk_500Medium', fontSize: 15, color: '#1E293B' },
  airportState: { fontFamily: 'SpaceGrotesk_400Regular', fontSize: 12, color: '#94A3B8' },
  loungeCount: { fontFamily: 'SpaceGrotesk_400Regular', fontSize: 12, color: '#64748B' },
  airportDist: { fontFamily: 'SpaceGrotesk_400Regular', fontSize: 11, color: '#94A3B8', marginTop: 2 },
});
