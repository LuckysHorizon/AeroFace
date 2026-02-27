import React from 'react';
import { StyleSheet, Text, View, ScrollView, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../App';

interface HomeScreenProps {
  navigation: NativeStackNavigationProp<RootStackParamList>;
}

export default function HomeScreen({ navigation }: HomeScreenProps) {
  return (
    <LinearGradient
      colors={['#E8F0FE', '#F5F7FA', '#FFFFFF']}
      style={styles.gradientBg}
    >
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.kicker}>AEROFACE</Text>
          <Text style={styles.title}>Welcome back</Text>
          <Text style={styles.subtitle}>Your journey, reimagined</Text>
        </View>

        {/* Flight Status Card - Empty State */}
        <View style={styles.flightCard}>
          <BlurView intensity={80} tint="light" style={styles.flightCardInner}>
            <View style={styles.emptyStateContainer}>
              <View style={styles.emptyIconCircle}>
                <Ionicons name="airplane-outline" size={32} color="#6B7280" />
              </View>
              <Text style={styles.emptyStateTitle}>No upcoming flights</Text>
              <Text style={styles.emptyStateSubtitle}>
                Book a flight to see your boarding details
              </Text>
            </View>
          </BlurView>
        </View>

        {/* Quick Actions Grid */}
        <View style={styles.quickActionsGrid}>
          <Pressable
            style={[styles.actionCard, styles.glassCard]}
            onPress={() => navigation.navigate('BoardingPassScan')}
          >
            <View style={styles.actionIconContainer}>
              <Ionicons name="scan-outline" size={28} color="#4F46E5" />
            </View>
            <View>
              <Text style={styles.actionTitle}>Scan Boarding Pass</Text>
              <Text style={styles.actionSubtitle}>Quick check-in</Text>
            </View>
          </Pressable>

          <Pressable style={[styles.actionCard, styles.whiteCard]}>
            <View style={styles.actionIconContainer}>
              <Ionicons name="accessibility-outline" size={28} color="#4F46E5" />
            </View>
            <View>
              <Text style={styles.actionTitle}>Register Face</Text>
              <Text style={styles.actionSubtitle}>Secure access</Text>
            </View>
          </Pressable>

          <Pressable style={[styles.actionCard, styles.whiteCard]}>
            <View style={styles.actionIconContainer}>
              <Ionicons name="calendar-outline" size={28} color="#4F46E5" />
            </View>
            <View>
              <Text style={styles.actionTitle}>My Bookings</Text>
              <Text style={styles.actionSubtitle}>View trips</Text>
            </View>
          </Pressable>

          <Pressable style={[styles.actionCard, styles.glassCard]}>
            <View style={styles.actionIconContainer}>
              <Ionicons name="business-outline" size={28} color="#4F46E5" />
            </View>
            <View>
              <Text style={styles.actionTitle}>Lounge Access</Text>
              <Text style={styles.actionSubtitle}>Premium entry</Text>
            </View>
          </Pressable>
        </View>

        {/* Analytics Cards - Empty State */}
        <View style={styles.analyticsRow}>
          <View style={styles.analyticsCard}>
            <Text style={styles.analyticsLabel}>TOTAL VISITS</Text>
            <View style={styles.analyticsValueRow}>
              <Text style={styles.analyticsValue}>--</Text>
            </View>
            <Text style={styles.emptyAnalyticsText}>Start traveling to track visits</Text>
          </View>

          <View style={styles.analyticsCard}>
            <Text style={styles.analyticsLabel}>MEMBERSHIP</Text>
            <View style={styles.membershipRow}>
              <Text style={styles.membershipValue}>--</Text>
            </View>
            <Text style={styles.emptyAnalyticsText}>Subscribe for premium benefits</Text>
          </View>
        </View>

        {/* Bottom padding for navbar clearance */}
        <View style={{ height: 100 }} />
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradientBg: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 60,
  },
  header: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
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
  flightCard: {
    marginHorizontal: 20,
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 24,
  },
  flightCardInner: {
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.8)',
  },
  emptyStateContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyStateTitle: {
    color: '#0B1F33',
    fontSize: 18,
    fontFamily: 'SpaceGrotesk_700Bold',
    marginBottom: 4,
  },
  emptyStateSubtitle: {
    color: '#6B7280',
    fontSize: 14,
    fontFamily: 'SpaceGrotesk_400Regular',
    textAlign: 'center',
  },
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 24,
  },
  actionCard: {
    width: '48%',
    aspectRatio: 1.1,
    borderRadius: 20,
    padding: 20,
    justifyContent: 'space-between',
  },
  glassCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.8)',
  },
  whiteCard: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#0B1F33',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  actionIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionTitle: {
    color: '#0B1F33',
    fontSize: 17,
    fontFamily: 'SpaceGrotesk_700Bold',
    marginTop: 'auto',
  },
  actionSubtitle: {
    color: '#6B7280',
    fontSize: 14,
    fontFamily: 'SpaceGrotesk_400Regular',
  },
  analyticsRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 24,
  },
  analyticsCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#0B1F33',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  analyticsLabel: {
    color: '#6B7280',
    fontSize: 13,
    fontFamily: 'SpaceGrotesk_500Medium',
    marginBottom: 12,
  },
  analyticsValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  analyticsValue: {
    color: '#0B1F33',
    fontSize: 32,
    fontFamily: 'SpaceGrotesk_700Bold',
  },
  membershipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  membershipValue: {
    color: '#0B1F33',
    fontSize: 20,
    fontFamily: 'SpaceGrotesk_700Bold',
  },
  emptyAnalyticsText: {
    color: '#9CA3AF',
    fontSize: 12,
    fontFamily: 'SpaceGrotesk_400Regular',
  },
});
