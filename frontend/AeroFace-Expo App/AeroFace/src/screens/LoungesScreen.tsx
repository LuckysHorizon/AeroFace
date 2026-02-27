import React, { useState, useEffect, useRef } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as Location from 'expo-location';

// ── Types ────────────────────────────────────────────────────────
interface Airport {
  code: string;
  city: string;
  state: string;
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
  google_place_id: string;
  distance: number;
  opening_hours?: string;
  access_info?: string;
  image_url?: string;
  amenities?: string[];
}

const SUPABASE_URL = 'https://fksgblzszxwmoqbmzbsj.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZrc2dibHpzenh3bW9xYm16YnNqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxNzY5NjksImV4cCI6MjA4Nzc1Mjk2OX0.aAh2Tj8CMiTjXpawt4afEA6YTCQevCV9SFhKJPlNZ-I';

export default function LoungesScreen() {
  const [lounges, setLounges] = useState<Lounge[]>([]);
  const [airports, setAirports] = useState<Airport[]>([]);
  const [selectedAirport, setSelectedAirport] = useState<string | null>(null);
  const [airportCity, setAirportCity] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [userCoords, setUserCoords] = useState<{ latitude: number; longitude: number } | null>(null);

  useEffect(() => {
    initAndFetch();
  }, []);

  // ── Location + Initial Fetch ──────────────────────────────────
  const initAndFetch = async () => {
    setLoading(true);
    setError(null);

    let latitude: number | null = null;
    let longitude: number | null = null;

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        latitude = loc.coords.latitude;
        longitude = loc.coords.longitude;
        setUserCoords({ latitude, longitude });
        console.log(`📍 User location: ${latitude}, ${longitude}`);
      }
    } catch (e) {
      console.log('Location unavailable, using default');
    }

    await fetchLounges(latitude, longitude, null);
  };

  // ── Fetch Lounges from Edge Function ──────────────────────────
  const fetchLounges = async (
    latitude: number | null,
    longitude: number | null,
    airportCode: string | null
  ) => {
    try {
      setLoading(true);
      setError(null);

      const body: any = {};
      if (latitude && longitude) {
        body.latitude = latitude;
        body.longitude = longitude;
      }
      if (airportCode) {
        body.airport_code = airportCode;
      }

      console.log('📡 Fetching lounges:', JSON.stringify(body));

      const response = await fetch(`${SUPABASE_URL}/functions/v1/fetch-lounges`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          apikey: SUPABASE_ANON_KEY,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error('❌ Error:', response.status, errText);
        throw new Error(`Server error (${response.status})`);
      }

      const data = await response.json();
      console.log(`✅ Got ${data.lounges?.length} lounges for ${data.selected_airport}`);

      setLounges(data.lounges || []);
      setAirports(data.airports || []);
      setSelectedAirport(data.selected_airport || null);
      setAirportCity(data.airport_city || '');
    } catch (err) {
      console.error('Error fetching lounges:', err);
      setError(err instanceof Error ? err.message : 'Failed to load lounges');
    } finally {
      setLoading(false);
    }
  };

  // ── Select an airport from dropdown ───────────────────────────
  const onSelectAirport = async (code: string) => {
    setShowDropdown(false);
    setSelectedAirport(code);
    await fetchLounges(userCoords?.latitude ?? null, userCoords?.longitude ?? null, code);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchLounges(
      userCoords?.latitude ?? null,
      userCoords?.longitude ?? null,
      selectedAirport
    );
    setRefreshing(false);
  };

  // ── Render Airport Dropdown Item ──────────────────────────────
  const renderAirportItem = ({ item }: { item: Airport }) => {
    const isSelected = item.code === selectedAirport;
    return (
      <Pressable
        style={[styles.dropdownItem, isSelected && styles.dropdownItemSelected]}
        onPress={() => onSelectAirport(item.code)}
      >
        <View style={styles.dropdownItemLeft}>
          <View style={[styles.airportCodeBadge, isSelected && styles.airportCodeBadgeSelected]}>
            <Text style={[styles.airportCodeText, isSelected && styles.airportCodeTextSelected]}>
              {item.code}
            </Text>
          </View>
          <View style={styles.dropdownTextGroup}>
            <Text style={[styles.dropdownCity, isSelected && styles.dropdownCitySelected]}>
              {item.city}
            </Text>
            <Text style={styles.dropdownState}>
              {item.state} · {item.loungeCount} lounge{item.loungeCount !== 1 ? 's' : ''}
            </Text>
          </View>
        </View>
        {item.distance !== null && (
          <Text style={styles.dropdownDistance}>{item.distance} km</Text>
        )}
      </Pressable>
    );
  };

  // ── Render Lounge Card ────────────────────────────────────────
  const renderLounge = (lounge: Lounge) => {
    const rating = lounge.rating || 0;
    const distance = lounge.distance || 0;

    return (
      <Pressable key={lounge.id} style={styles.loungeCard}>
        <BlurView intensity={80} tint="light" style={styles.cardBlur}>
          <View style={styles.cardContent}>
            {/* Header */}
            <View style={styles.cardHeader}>
              <View style={styles.nameSection}>
                <Text style={styles.loungeName} numberOfLines={2}>
                  {lounge.name}
                </Text>
                <View style={styles.terminalRow}>
                  <Ionicons name="airplane" size={12} color="#6B7280" />
                  <Text style={styles.terminalText}>
                    {lounge.airport_code} · {lounge.terminal}
                  </Text>
                </View>
              </View>
              <View style={styles.distanceBadge}>
                <Ionicons name="navigate" size={14} color="#4F46E5" />
                <Text style={styles.distanceText}>{distance} km</Text>
              </View>
            </View>

            {/* Address */}
            <View style={styles.infoRow}>
              <Ionicons name="location-outline" size={16} color="#6B7280" />
              <Text style={styles.infoText} numberOfLines={2}>
                {lounge.address}
              </Text>
            </View>

            {/* Rating + Hours row */}
            <View style={styles.metaRow}>
              {rating > 0 && (
                <View style={styles.metaItem}>
                  <Ionicons name="star" size={14} color="#F59E0B" />
                  <Text style={styles.metaText}>{rating.toFixed(1)}</Text>
                </View>
              )}
              {lounge.opening_hours && (
                <View style={styles.metaItem}>
                  <Ionicons name="time-outline" size={14} color="#6B7280" />
                  <Text style={styles.metaText}>{lounge.opening_hours}</Text>
                </View>
              )}
            </View>

            {/* Access Info */}
            {lounge.access_info && (
              <View style={styles.accessRow}>
                <Ionicons name="key-outline" size={14} color="#10B981" />
                <Text style={styles.accessText}>{lounge.access_info}</Text>
              </View>
            )}

            {/* Amenities */}
            {lounge.amenities && lounge.amenities.length > 0 && (
              <View style={styles.amenitiesRow}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.amenitiesList}
                >
                  {lounge.amenities.map((amenity, idx) => (
                    <View key={idx} style={styles.amenityBadge}>
                      <Text style={styles.amenityText}>{amenity}</Text>
                    </View>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* Action */}
            <Pressable style={styles.actionButton}>
              <Ionicons name="open" size={16} color="#FFF" />
              <Text style={styles.buttonText}>View Details</Text>
            </Pressable>
          </View>
        </BlurView>
      </Pressable>
    );
  };

  // ── Main Render ───────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#E8F0FE', '#F5F7FA', '#FFFFFF']}
        style={styles.gradientBg}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#4F46E5" />
          }
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.kicker}>AIRPORT LOUNGES</Text>
            <Text style={styles.title}>Find Your Lounge</Text>
            <Text style={styles.subtitle}>
              Premium airport lounge access across India
            </Text>
          </View>

          {/* Airport Selector */}
          <Pressable style={styles.selectorCard} onPress={() => setShowDropdown(true)}>
            <BlurView intensity={90} tint="light" style={styles.selectorBlur}>
              <View style={styles.selectorContent}>
                <View style={styles.selectorLeft}>
                  <View style={styles.selectorIcon}>
                    <Ionicons name="airplane" size={20} color="#4F46E5" />
                  </View>
                  <View>
                    <Text style={styles.selectorLabel}>Airport</Text>
                    <Text style={styles.selectorValue}>
                      {selectedAirport
                        ? `${airportCity} (${selectedAirport})`
                        : 'Select Airport'}
                    </Text>
                  </View>
                </View>
                <View style={styles.selectorRight}>
                  <View style={styles.countBadge}>
                    <Text style={styles.countText}>{lounges.length}</Text>
                  </View>
                  <Ionicons name="chevron-down" size={20} color="#6B7280" />
                </View>
              </View>
            </BlurView>
          </Pressable>

          {/* Location Indicator */}
          {userCoords && selectedAirport && (
            <View style={styles.locationIndicator}>
              <Ionicons name="navigate-outline" size={14} color="#10B981" />
              <Text style={styles.locationText}>
                Showing lounges near your location · {airportCity}
              </Text>
            </View>
          )}

          {/* Loading */}
          {loading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#4F46E5" />
              <Text style={styles.loadingText}>Finding lounges...</Text>
            </View>
          )}

          {/* Error */}
          {error && !loading && (
            <View style={styles.errorContainer}>
              <View style={styles.errorIcon}>
                <Ionicons name="alert-circle-outline" size={48} color="#EF4444" />
              </View>
              <Text style={styles.errorTitle}>Oops!</Text>
              <Text style={styles.errorText}>{error}</Text>
              <Pressable style={styles.retryButton} onPress={onRefresh}>
                <Text style={styles.retryButtonText}>Try Again</Text>
              </Pressable>
            </View>
          )}

          {/* Empty */}
          {!loading && lounges.length === 0 && !error && (
            <View style={styles.emptyState}>
              <View style={styles.iconCircle}>
                <Ionicons name="business-outline" size={48} color="#4F46E5" />
              </View>
              <Text style={styles.emptyTitle}>No lounges found</Text>
              <Text style={styles.emptySubtitle}>
                Try selecting a different airport from the dropdown above.
              </Text>
            </View>
          )}

          {/* Lounges */}
          {!loading && lounges.length > 0 && lounges.map((l) => renderLounge(l))}
        </ScrollView>
      </LinearGradient>

      {/* ── Airport Selection Modal ──────────────────────────── */}
      <Modal
        visible={showDropdown}
        animationType="slide"
        transparent
        onRequestClose={() => setShowDropdown(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Airport</Text>
              <Pressable onPress={() => setShowDropdown(false)} style={styles.modalClose}>
                <Ionicons name="close" size={24} color="#374151" />
              </Pressable>
            </View>
            {userCoords && (
              <View style={styles.modalLocationHint}>
                <Ionicons name="navigate-outline" size={14} color="#4F46E5" />
                <Text style={styles.modalLocationText}>Sorted by distance from you</Text>
              </View>
            )}
            <FlatList
              data={airports}
              renderItem={renderAirportItem}
              keyExtractor={(item) => item.code}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.dropdownList}
              ItemSeparatorComponent={() => <View style={styles.dropdownSeparator} />}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ── Styles ──────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FA' },
  gradientBg: { flex: 1 },
  scrollView: { flex: 1 },
  scrollContent: { paddingTop: 60, paddingBottom: 120 },

  /* Header */
  header: { paddingHorizontal: 24, paddingBottom: 20 },
  kicker: {
    color: '#6B7280',
    fontSize: 12,
    letterSpacing: 2,
    textTransform: 'uppercase',
    fontFamily: 'SpaceGrotesk_500Medium',
    marginBottom: 8,
  },
  title: {
    color: '#0B1F33',
    fontSize: 34,
    fontFamily: 'SpaceGrotesk_700Bold',
    marginBottom: 4,
  },
  subtitle: {
    color: '#4B5563',
    fontSize: 16,
    fontFamily: 'SpaceGrotesk_400Regular',
  },

  /* Airport Selector */
  selectorCard: {
    marginHorizontal: 20,
    marginBottom: 12,
    borderRadius: 16,
    overflow: 'hidden',
  },
  selectorBlur: {
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.9)',
    borderRadius: 16,
  },
  selectorContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  selectorLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  selectorIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(79,70,229,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectorLabel: {
    color: '#6B7280',
    fontSize: 11,
    fontFamily: 'SpaceGrotesk_500Medium',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  selectorValue: {
    color: '#0B1F33',
    fontSize: 16,
    fontFamily: 'SpaceGrotesk_700Bold',
    marginTop: 2,
  },
  selectorRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  countBadge: {
    backgroundColor: '#4F46E5',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  countText: { color: '#FFF', fontSize: 12, fontFamily: 'SpaceGrotesk_700Bold' },

  /* Location Indicator */
  locationIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginHorizontal: 24,
    marginBottom: 16,
  },
  locationText: {
    color: '#10B981',
    fontSize: 12,
    fontFamily: 'SpaceGrotesk_500Medium',
  },

  /* Loading */
  loadingContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 80 },
  loadingText: {
    marginTop: 16,
    color: '#4B5563',
    fontSize: 16,
    fontFamily: 'SpaceGrotesk_500Medium',
  },

  /* Error */
  errorContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    paddingTop: 60,
  },
  errorIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(239,68,68,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  errorTitle: {
    color: '#0B1F33',
    fontSize: 20,
    fontFamily: 'SpaceGrotesk_700Bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  errorText: {
    color: '#6B7280',
    fontSize: 14,
    fontFamily: 'SpaceGrotesk_400Regular',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },

  /* Empty */
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    paddingTop: 60,
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 999,
    backgroundColor: 'rgba(79,70,229,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    color: '#0B1F33',
    fontSize: 20,
    fontFamily: 'SpaceGrotesk_700Bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    color: '#6B7280',
    fontSize: 14,
    fontFamily: 'SpaceGrotesk_400Regular',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },

  /* Lounge Card */
  loungeCard: { marginHorizontal: 20, marginBottom: 16, borderRadius: 20, overflow: 'hidden' },
  cardBlur: {
    backgroundColor: 'rgba(255,255,255,0.6)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.8)',
  },
  cardContent: { padding: 20 },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  nameSection: { flex: 1, marginRight: 12 },
  loungeName: {
    color: '#0B1F33',
    fontSize: 18,
    fontFamily: 'SpaceGrotesk_700Bold',
    marginBottom: 4,
  },
  terminalRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  terminalText: {
    color: '#6B7280',
    fontSize: 12,
    fontFamily: 'SpaceGrotesk_500Medium',
  },
  distanceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(79,70,229,0.1)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    gap: 4,
  },
  distanceText: { color: '#4F46E5', fontSize: 13, fontFamily: 'SpaceGrotesk_700Bold' },

  /* Info */
  infoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8 },
  infoText: { color: '#6B7280', fontSize: 13, fontFamily: 'SpaceGrotesk_400Regular', flex: 1 },

  /* Meta row */
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 8 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { color: '#6B7280', fontSize: 13, fontFamily: 'SpaceGrotesk_500Medium' },

  /* Access */
  accessRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
    backgroundColor: 'rgba(16,185,129,0.08)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  accessText: { color: '#059669', fontSize: 12, fontFamily: 'SpaceGrotesk_500Medium', flex: 1 },

  /* Amenities */
  amenitiesRow: { marginBottom: 16 },
  amenitiesList: { flexGrow: 0 },
  amenityBadge: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginRight: 8,
  },
  amenityText: { color: '#4B5563', fontSize: 12, fontFamily: 'SpaceGrotesk_500Medium' },

  /* Action */
  actionButton: {
    flexDirection: 'row',
    backgroundColor: '#4F46E5',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  buttonText: { color: '#FFF', fontSize: 14, fontFamily: 'SpaceGrotesk_700Bold' },

  /* Retry */
  retryButton: { backgroundColor: '#4F46E5', paddingHorizontal: 32, paddingVertical: 12, borderRadius: 12 },
  retryButtonText: { color: '#FFF', fontSize: 14, fontFamily: 'SpaceGrotesk_700Bold', textAlign: 'center' },

  /* ── Modal / Dropdown ──────────────────────────────────────── */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '70%',
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 12,
  },
  modalTitle: { fontSize: 20, fontFamily: 'SpaceGrotesk_700Bold', color: '#0B1F33' },
  modalClose: { padding: 4 },
  modalLocationHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 24,
    paddingBottom: 12,
  },
  modalLocationText: { color: '#4F46E5', fontSize: 12, fontFamily: 'SpaceGrotesk_500Medium' },
  dropdownList: { paddingHorizontal: 16 },
  dropdownSeparator: { height: 1, backgroundColor: '#F3F4F6', marginHorizontal: 8 },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  dropdownItemSelected: { backgroundColor: 'rgba(79,70,229,0.06)' },
  dropdownItemLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  airportCodeBadge: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  airportCodeBadgeSelected: { backgroundColor: '#4F46E5' },
  airportCodeText: { fontSize: 14, fontFamily: 'SpaceGrotesk_700Bold', color: '#374151' },
  airportCodeTextSelected: { color: '#FFF' },
  dropdownTextGroup: { flex: 1 },
  dropdownCity: { fontSize: 15, fontFamily: 'SpaceGrotesk_700Bold', color: '#0B1F33' },
  dropdownCitySelected: { color: '#4F46E5' },
  dropdownState: { fontSize: 12, fontFamily: 'SpaceGrotesk_400Regular', color: '#6B7280', marginTop: 2 },
  dropdownDistance: { fontSize: 12, fontFamily: 'SpaceGrotesk_500Medium', color: '#9CA3AF' },
});
