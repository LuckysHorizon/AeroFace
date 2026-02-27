import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import {
  getLoungesWithPlans,
  clearSubscriptionCache,
  LoungeWithPlans,
  LoungePlanPublic,
} from '../lib/subscriptionApi';
import {
  createPaymentOrder,
  CreateOrderResponse,
  PaymentResult,
} from '../lib/cashfreePayment';
import CashfreeCheckoutScreen from './CashfreeCheckoutScreen';
import { supabase } from '../lib/supabase';

interface UserMembership {
  plan_id: string;
  lounge_id: string;
  status: string;
  end_date: string;
}

// ── Helpers ────────────────────────────────────────────────────────

const formatCurrency = (val: number) =>
  '₹' + val.toLocaleString('en-IN', { maximumFractionDigits: 0 });

const formatDuration = (days: number) => {
  if (days >= 365) return `${Math.floor(days / 365)} Year${days >= 730 ? 's' : ''}`;
  if (days >= 30) return `${Math.floor(days / 30)} Month${days >= 60 ? 's' : ''}`;
  if (days >= 7) return `${Math.floor(days / 7)} Week${days >= 14 ? 's' : ''}`;
  return `${days} Day${days !== 1 ? 's' : ''}`;
};

interface AirportOption {
  code: string;
  name: string;
  loungeCount: number;
  planCount: number;
}

// ═══════════════════════════════════════════════════════════════════

export default function SubscriptionsScreen() {
  const [allLounges, setAllLounges] = useState<LoungeWithPlans[]>([]);
  const [filteredLounges, setFilteredLounges] = useState<LoungeWithPlans[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedLounge, setExpandedLounge] = useState<string | null>(null);
  const [locationName, setLocationName] = useState('Detecting location...');
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);

  // Airport filter
  const [airports, setAirports] = useState<AirportOption[]>([]);
  const [selectedAirport, setSelectedAirport] = useState<string | null>(null);
  const [showAirportPicker, setShowAirportPicker] = useState(false);

  // Payment state
  const [paymentOrder, setPaymentOrder] = useState<CreateOrderResponse | null>(null);
  const [showCheckout, setShowCheckout] = useState(false);
  const [subscribing, setSubscribing] = useState<string | null>(null);

  // Active memberships
  const [memberships, setMemberships] = useState<Map<string, UserMembership>>(new Map());

  const hasInit = useRef(false);

  useEffect(() => {
    if (hasInit.current) return;
    hasInit.current = true;
    loadData();
  }, []);

  async function loadData() {
    try {
      setError(null);
      if (!refreshing) setLoading(true);

      let lat: number | null = null;
      let lng: number | null = null;

      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          lat = loc.coords.latitude;
          lng = loc.coords.longitude;
          setUserCoords({ lat, lng });

          try {
            const [place] = await Location.reverseGeocodeAsync({
              latitude: lat, longitude: lng,
            });
            if (place) {
              setLocationName(
                [place.city, place.region].filter(Boolean).join(', ')
                || 'Your Location'
              );
            }
          } catch {
            setLocationName('Your Location');
          }
        } else {
          setLocationName('Location unavailable');
        }
      } catch {
        setLocationName('Location unavailable');
      }

      const data = await getLoungesWithPlans({ latitude: lat, longitude: lng });
      setAllLounges(data);

      const airportMap = new Map<string, AirportOption>();
      data.forEach(l => {
        const code = (l.airport_code || 'UNKNOWN').toUpperCase();
        const existing = airportMap.get(code);
        if (existing) {
          existing.loungeCount += 1;
          existing.planCount += l.plans.length;
        } else {
          airportMap.set(code, {
            code,
            name: l.airport_name,
            loungeCount: 1,
            planCount: l.plans.length,
          });
        }
      });
      setAirports(Array.from(airportMap.values()).sort((a, b) => a.name.localeCompare(b.name)));
      applyFilter(data, selectedAirport);

      // Fetch user's active memberships
      try {
        const { data: mems } = await supabase
          .from('lounge_memberships')
          .select('plan_id, lounge_id, status, end_date')
          .eq('status', 'active')
          .gte('end_date', new Date().toISOString());
        const memMap = new Map<string, UserMembership>();
        (mems || []).forEach((m: any) => {
          if (m.plan_id) memMap.set(m.plan_id, m);
        });
        setMemberships(memMap);
      } catch { /* ignore */ }
    } catch (e: any) {
      setError(e.message || 'Failed to load subscriptions');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  function applyFilter(lounges: LoungeWithPlans[], airportCode: string | null) {
    if (!airportCode) {
      setFilteredLounges(lounges);
    } else {
      setFilteredLounges(
        lounges.filter(l => (l.airport_code || '').toUpperCase() === airportCode)
      );
    }
  }

  function selectAirport(code: string | null) {
    setSelectedAirport(code);
    setShowAirportPicker(false);
    setExpandedLounge(null);
    applyFilter(allLounges, code);
  }

  const onRefresh = useCallback(() => {
    clearSubscriptionCache();
    setRefreshing(true);
    loadData();
  }, [selectedAirport]);

  const toggleExpand = (id: string) => {
    setExpandedLounge(prev => prev === id ? null : id);
  };

  // ── Payment Flow ─────────────────────────────────────────────────

  async function handleSubscribe(plan: LoungePlanPublic, loungeId: string) {
    try {
      setSubscribing(plan.id);
      const order = await createPaymentOrder(plan.id, loungeId);
      setPaymentOrder(order);
      setShowCheckout(true);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not start payment. Please try again.');
    } finally {
      setSubscribing(null);
    }
  }

  function handlePaymentSuccess(result: PaymentResult) {
    setShowCheckout(false);
    setPaymentOrder(null);
    Alert.alert(
      '🎉 Subscription Active!',
      `You are now subscribed to ${result.plan_name || 'the plan'}.\nValid until: ${result.end_date
        ? new Date(result.end_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
        : 'N/A'}`,
      [{ text: 'Great!' }]
    );
    clearSubscriptionCache();
    loadData();
  }

  function handlePaymentCancel() {
    setShowCheckout(false);
    setPaymentOrder(null);
  }

  // ── Plan Card ──────────────────────────────────────────────────

  function PlanCard({ plan, loungeId }: { plan: LoungePlanPublic; loungeId: string }) {
    const isSubscribing = subscribing === plan.id;
    const membership = memberships.get(plan.id);
    const isSubscribed = !!membership;
    const endDate = membership?.end_date ? new Date(membership.end_date) : null;

    return (
      <View style={[s.planCard, isSubscribed && s.planCardSubscribed]}>
        <View style={s.planHeader}>
          <View style={{ flex: 1 }}>
            <Text style={s.planName}>{plan.name}</Text>
            {isSubscribed && endDate && (
              <Text style={s.subscribedUntil}>
                Active until {endDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              </Text>
            )}
          </View>
          <View style={s.priceWrap}>
            <Text style={s.planPrice}>{formatCurrency(plan.price)}</Text>
            <Text style={s.planDuration}>/{formatDuration(plan.duration_days)}</Text>
          </View>
        </View>

        {plan.description && (
          <Text style={s.planDesc} numberOfLines={2}>{plan.description}</Text>
        )}

        {plan.features.length > 0 && (
          <View style={s.featuresList}>
            {plan.features.map((feat, idx) => (
              <View key={idx} style={s.featureRow}>
                <Ionicons name="checkmark-circle" size={16} color={isSubscribed ? '#059669' : '#4F46E5'} />
                <Text style={s.featureText}>{feat}</Text>
              </View>
            ))}
          </View>
        )}

        {isSubscribed ? (
          <View style={s.subscribedRow}>
            <View style={s.subscribedBadge}>
              <Ionicons name="checkmark-circle" size={16} color="#059669" />
              <Text style={s.subscribedBadgeText}>Active Subscription</Text>
            </View>
            <Pressable
              style={s.renewBtn}
              onPress={() => handleSubscribe(plan, loungeId)}
              disabled={isSubscribing}
            >
              {isSubscribing ? (
                <ActivityIndicator size="small" color="#4F46E5" />
              ) : (
                <Text style={s.renewBtnText}>Renew</Text>
              )}
            </Pressable>
          </View>
        ) : (
          <Pressable
            style={[s.subscribeBtn, isSubscribing && { opacity: 0.6 }]}
            onPress={() => handleSubscribe(plan, loungeId)}
            disabled={isSubscribing}
          >
            {isSubscribing ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Text style={s.subscribeBtnText}>Subscribe</Text>
                <Ionicons name="arrow-forward-outline" size={16} color="#FFFFFF" />
              </>
            )}
          </Pressable>
        )}
      </View>
    );
  }

  // ── Lounge Section ─────────────────────────────────────────────

  function renderLounge({ item }: { item: LoungeWithPlans }) {
    const isExpanded = expandedLounge === item.id;
    const hasPlan = item.plans.length > 0;

    return (
      <View style={s.loungeCard}>
        <Pressable style={s.loungeCardHeader} onPress={() => toggleExpand(item.id)}>
          <View style={s.loungeIconCircle}>
            <Ionicons name="business-outline" size={22} color="#4F46E5" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.loungeName}>{item.name}</Text>
            <View style={s.loungeMetaRow}>
              <Ionicons name="airplane-outline" size={12} color="#6B7280" />
              <Text style={s.loungeMeta}>
                {item.airport_name}
                {item.airport_code ? ` (${item.airport_code})` : ''}
                {item.terminal ? ` • T${item.terminal}` : ''}
              </Text>
            </View>
            {item.distance != null && (
              <View style={s.loungeMetaRow}>
                <Ionicons name="location-outline" size={12} color="#6B7280" />
                <Text style={s.loungeMeta}>
                  {item.distance < 1
                    ? `${(item.distance * 1000).toFixed(0)} m away`
                    : `${item.distance.toFixed(1)} km away`}
                </Text>
              </View>
            )}
          </View>
          <View style={s.loungeRight}>
            {hasPlan && (
              <View style={s.planCountBadge}>
                <Text style={s.planCountText}>
                  {item.plans.length} plan{item.plans.length !== 1 ? 's' : ''}
                </Text>
              </View>
            )}
            <Ionicons
              name={isExpanded ? 'chevron-up' : 'chevron-down'}
              size={20}
              color="#6B7280"
            />
          </View>
        </Pressable>

        {isExpanded && (
          <View style={s.plansContainer}>
            {hasPlan ? (
              item.plans.map(plan => (
                <PlanCard key={plan.id} plan={plan} loungeId={item.id} />
              ))
            ) : (
              <View style={s.noPlanBox}>
                <Ionicons name="information-circle-outline" size={20} color="#9CA3AF" />
                <Text style={s.noPlanText}>No active plans available yet.</Text>
              </View>
            )}
          </View>
        )}
      </View>
    );
  }

  // ── Counts ──────────────────────────────────────────────────────

  const totalPlans = filteredLounges.reduce((sum, l) => sum + l.plans.length, 0);
  const loungesWithPlans = filteredLounges.filter(l => l.plans.length > 0).length;

  const selectedAirportLabel = selectedAirport
    ? airports.find(a => a.code === selectedAirport)?.name || selectedAirport
    : 'All Airports';

  return (
    <View style={s.container}>
      <LinearGradient colors={['#E8F0FE', '#F5F7FA', '#FFFFFF']} style={s.gradientBg}>
        <View style={s.header}>
          <Text style={s.kicker}>SUBSCRIPTIONS</Text>
          <Text style={s.title}>Available Plans</Text>
          <Text style={s.subtitle}>Browse lounge memberships near you</Text>

          <View style={s.filterRow}>
            <View style={s.locationChip}>
              <Ionicons name="location" size={14} color="#4F46E5" />
              <Text style={s.locationText} numberOfLines={1}>{locationName}</Text>
            </View>

            <Pressable
              style={s.airportSelector}
              onPress={() => setShowAirportPicker(true)}
            >
              <Ionicons name="airplane" size={14} color="#4F46E5" />
              <Text style={s.airportSelectorText} numberOfLines={1}>
                {selectedAirportLabel}
              </Text>
              <Ionicons name="chevron-down" size={14} color="#6B7280" />
            </Pressable>
          </View>

          {!loading && !error && filteredLounges.length > 0 && (
            <View style={s.chipRow}>
              <View style={s.chip}>
                <Text style={s.chipValue}>{filteredLounges.length}</Text>
                <Text style={s.chipLabel}>Lounges</Text>
              </View>
              <View style={s.chip}>
                <Text style={s.chipValue}>{loungesWithPlans}</Text>
                <Text style={s.chipLabel}>With Plans</Text>
              </View>
              <View style={s.chip}>
                <Text style={s.chipValue}>{totalPlans}</Text>
                <Text style={s.chipLabel}>Plans</Text>
              </View>
            </View>
          )}
        </View>

        {loading && (
          <View style={s.center}>
            <ActivityIndicator size="large" color="#4F46E5" />
            <Text style={s.centerText}>Discovering lounges near you...</Text>
          </View>
        )}

        {error && !loading && (
          <View style={s.center}>
            <Ionicons name="alert-circle-outline" size={48} color="#DC2626" />
            <Text style={s.centerText}>{error}</Text>
            <Pressable style={s.retryBtn} onPress={loadData}>
              <Text style={s.retryBtnText}>Retry</Text>
            </Pressable>
          </View>
        )}

        {!loading && !error && filteredLounges.length === 0 && (
          <View style={s.center}>
            <View style={s.emptyIcon}>
              <Ionicons name="card-outline" size={48} color="#4F46E5" />
            </View>
            <Text style={s.emptyTitle}>
              {selectedAirport ? 'No lounges at this airport' : 'No lounges found'}
            </Text>
            <Text style={s.emptySubtitle}>
              {selectedAirport
                ? 'Try selecting a different airport or switch to "All Airports".'
                : 'There are no registered lounges near your location yet.'}
            </Text>
            {selectedAirport && (
              <Pressable style={s.retryBtn} onPress={() => selectAirport(null)}>
                <Text style={s.retryBtnText}>Show All</Text>
              </Pressable>
            )}
          </View>
        )}

        {!loading && !error && filteredLounges.length > 0 && (
          <FlatList
            data={filteredLounges}
            keyExtractor={item => item.id}
            renderItem={renderLounge}
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 120 }}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor="#4F46E5"
                colors={['#4F46E5']}
              />
            }
          />
        )}

        {/* ── Airport Picker Modal ── */}
        <Modal visible={showAirportPicker} animationType="slide" transparent>
          <View style={s.modalOverlay}>
            <View style={s.modalCard}>
              <View style={s.modalHeader}>
                <Text style={s.modalTitle}>Select Airport</Text>
                <Pressable onPress={() => setShowAirportPicker(false)}>
                  <Ionicons name="close" size={24} color="#6B7280" />
                </Pressable>
              </View>

              <Pressable
                style={[s.airportItem, !selectedAirport && s.airportItemActive]}
                onPress={() => selectAirport(null)}
              >
                <View style={s.airportItemIcon}>
                  <Ionicons name="globe-outline" size={20} color="#4F46E5" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.airportItemName}>All Airports</Text>
                  <Text style={s.airportItemMeta}>
                    {allLounges.length} lounge{allLounges.length !== 1 ? 's' : ''} •{' '}
                    {allLounges.reduce((s, l) => s + l.plans.length, 0)} plans
                  </Text>
                </View>
                {!selectedAirport && (
                  <Ionicons name="checkmark-circle" size={22} color="#4F46E5" />
                )}
              </Pressable>

              <FlatList
                data={airports}
                keyExtractor={a => a.code}
                renderItem={({ item: airport }) => (
                  <Pressable
                    style={[
                      s.airportItem,
                      selectedAirport === airport.code && s.airportItemActive,
                    ]}
                    onPress={() => selectAirport(airport.code)}
                  >
                    <View style={s.airportItemIcon}>
                      <Ionicons name="airplane" size={20} color="#4F46E5" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.airportItemName}>
                        {airport.name}
                        <Text style={s.airportItemCode}> ({airport.code})</Text>
                      </Text>
                      <Text style={s.airportItemMeta}>
                        {airport.loungeCount} lounge{airport.loungeCount !== 1 ? 's' : ''} •{' '}
                        {airport.planCount} plan{airport.planCount !== 1 ? 's' : ''}
                      </Text>
                    </View>
                    {selectedAirport === airport.code && (
                      <Ionicons name="checkmark-circle" size={22} color="#4F46E5" />
                    )}
                  </Pressable>
                )}
                contentContainerStyle={{ paddingBottom: 20 }}
                showsVerticalScrollIndicator={false}
              />
            </View>
          </View>
        </Modal>

        {/* ── Cashfree Checkout Modal ── */}
        <Modal visible={showCheckout} animationType="slide" presentationStyle="fullScreen">
          {paymentOrder && (
            <CashfreeCheckoutScreen
              orderId={paymentOrder.orderId}
              sessionId={paymentOrder.sessionId}
              paymentUrl={paymentOrder.paymentUrl}
              planName={paymentOrder.planName}
              amount={paymentOrder.amount}
              currency={paymentOrder.currency}
              onSuccess={handlePaymentSuccess}
              onCancel={handlePaymentCancel}
            />
          )}
        </Modal>
      </LinearGradient>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FA' },
  gradientBg: { flex: 1 },

  header: { paddingTop: Platform.OS === 'ios' ? 60 : 50, paddingHorizontal: 24, paddingBottom: 12 },
  kicker: { color: '#6B7280', fontSize: 12, letterSpacing: 2, fontFamily: 'SpaceGrotesk_500Medium', marginBottom: 6 },
  title: { color: '#0B1F33', fontSize: 30, fontFamily: 'SpaceGrotesk_700Bold', marginBottom: 4 },
  subtitle: { color: '#4B5563', fontSize: 15, fontFamily: 'SpaceGrotesk_400Regular' },

  filterRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  locationChip: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#FFFFFF', paddingHorizontal: 12, paddingVertical: 10,
    borderRadius: 14, borderWidth: 1, borderColor: '#E8EDF2',
  },
  locationText: { color: '#4F46E5', fontSize: 13, fontFamily: 'SpaceGrotesk_500Medium', flex: 1 },
  airportSelector: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#EEF2FF', paddingHorizontal: 12, paddingVertical: 10,
    borderRadius: 14, borderWidth: 1, borderColor: '#C7D2FE',
  },
  airportSelectorText: { color: '#4F46E5', fontSize: 13, fontFamily: 'SpaceGrotesk_500Medium', flex: 1 },

  chipRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  chip: {
    flex: 1, backgroundColor: '#FFFFFF', borderRadius: 14, paddingVertical: 10,
    alignItems: 'center', borderWidth: 1, borderColor: '#E8EDF2',
    shadowColor: '#0B1F33', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  chipValue: { color: '#4F46E5', fontSize: 20, fontFamily: 'SpaceGrotesk_700Bold' },
  chipLabel: { color: '#6B7280', fontSize: 10, letterSpacing: 0.5, fontFamily: 'SpaceGrotesk_500Medium', marginTop: 2 },

  center: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 12, paddingHorizontal: 40 },
  centerText: { color: '#6B7280', fontSize: 14, fontFamily: 'SpaceGrotesk_400Regular', textAlign: 'center' },

  retryBtn: { backgroundColor: '#4F46E5', borderRadius: 12, paddingHorizontal: 24, paddingVertical: 10, marginTop: 8 },
  retryBtnText: { color: '#FFFFFF', fontSize: 14, fontFamily: 'SpaceGrotesk_700Bold' },

  emptyIcon: {
    width: 96, height: 96, borderRadius: 999,
    backgroundColor: 'rgba(79, 70, 229, 0.1)', alignItems: 'center', justifyContent: 'center',
  },
  emptyTitle: { color: '#0B1F33', fontSize: 20, fontFamily: 'SpaceGrotesk_700Bold', textAlign: 'center' },
  emptySubtitle: { color: '#6B7280', fontSize: 15, fontFamily: 'SpaceGrotesk_400Regular', textAlign: 'center', lineHeight: 22 },

  loungeCard: {
    backgroundColor: '#FFFFFF', borderRadius: 20, marginBottom: 14, overflow: 'hidden',
    shadowColor: '#0B1F33', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06, shadowRadius: 10, elevation: 3,
  },
  loungeCardHeader: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  loungeIconCircle: {
    width: 48, height: 48, borderRadius: 16,
    backgroundColor: 'rgba(79, 70, 229, 0.08)', alignItems: 'center', justifyContent: 'center',
  },
  loungeName: { color: '#0B1F33', fontSize: 16, fontFamily: 'SpaceGrotesk_700Bold' },
  loungeMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  loungeMeta: { color: '#6B7280', fontSize: 12, fontFamily: 'SpaceGrotesk_400Regular' },
  loungeRight: { alignItems: 'flex-end', gap: 6 },
  planCountBadge: { backgroundColor: '#EEF2FF', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10 },
  planCountText: { color: '#4F46E5', fontSize: 11, fontFamily: 'SpaceGrotesk_500Medium' },

  plansContainer: { paddingHorizontal: 16, paddingBottom: 16, gap: 10 },
  noPlanBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#F9FAFB', padding: 14, borderRadius: 12,
  },
  noPlanText: { color: '#9CA3AF', fontSize: 13, fontFamily: 'SpaceGrotesk_400Regular' },

  planCard: {
    backgroundColor: '#F9FAFB', borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: '#E8EDF2',
  },
  planHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  planName: { color: '#0B1F33', fontSize: 16, fontFamily: 'SpaceGrotesk_700Bold', flex: 1, marginRight: 8 },
  priceWrap: { alignItems: 'flex-end' },
  planPrice: { color: '#4F46E5', fontSize: 22, fontFamily: 'SpaceGrotesk_700Bold' },
  planDuration: { color: '#6B7280', fontSize: 11, fontFamily: 'SpaceGrotesk_400Regular', marginTop: -2 },
  planDesc: { color: '#6B7280', fontSize: 13, fontFamily: 'SpaceGrotesk_400Regular', marginBottom: 10, lineHeight: 19 },

  featuresList: { gap: 6, marginBottom: 12 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  featureText: { color: '#374151', fontSize: 13, fontFamily: 'SpaceGrotesk_400Regular' },

  subscribeBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: '#4F46E5', borderRadius: 12, paddingVertical: 12,
  },
  subscribeBtnText: { color: '#FFFFFF', fontSize: 15, fontFamily: 'SpaceGrotesk_700Bold' },

  // Subscribed state
  planCardSubscribed: { borderColor: '#059669', borderWidth: 1.5, backgroundColor: '#F0FDF4' },
  subscribedUntil: { color: '#059669', fontSize: 11, fontFamily: 'SpaceGrotesk_500Medium', marginTop: 2 },
  subscribedRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  subscribedBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#ECFDF5', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
  subscribedBadgeText: { color: '#059669', fontSize: 12, fontFamily: 'SpaceGrotesk_700Bold' },
  renewBtn: { backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: '#4F46E5', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 8 },
  renewBtnText: { color: '#4F46E5', fontSize: 13, fontFamily: 'SpaceGrotesk_700Bold' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    maxHeight: '70%',
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { color: '#0B1F33', fontSize: 22, fontFamily: 'SpaceGrotesk_700Bold' },

  airportItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 14, paddingHorizontal: 4,
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  airportItemActive: { backgroundColor: '#EEF2FF', borderRadius: 14, paddingHorizontal: 12, marginHorizontal: -8 },
  airportItemIcon: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: 'rgba(79,70,229,0.08)', alignItems: 'center', justifyContent: 'center',
  },
  airportItemName: { color: '#0B1F33', fontSize: 15, fontFamily: 'SpaceGrotesk_500Medium' },
  airportItemCode: { color: '#6B7280', fontFamily: 'SpaceGrotesk_400Regular' },
  airportItemMeta: { color: '#6B7280', fontSize: 12, fontFamily: 'SpaceGrotesk_400Regular', marginTop: 2 },
});
