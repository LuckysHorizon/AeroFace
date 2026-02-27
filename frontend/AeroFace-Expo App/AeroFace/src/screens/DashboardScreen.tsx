import { BlurView } from 'expo-blur';
import { useState, useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../App';

import HomeScreen from './HomeScreen';
import LoungesScreen from './LoungesScreen';
import SubscriptionsScreen from './SubscriptionsScreen';
import ProfileScreen from './ProfileScreen';

type NavItem = 'Dashboard' | 'Lounges' | 'Subscriptions' | 'Profile';
type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type DashboardRouteProp = NativeStackScreenProps<RootStackParamList, 'Dashboard'>['route'];

export default function DashboardScreen() {
  const [activeNav, setActiveNav] = useState<NavItem>('Dashboard');
  const [initialAirportCode, setInitialAirportCode] = useState<string | undefined>(undefined);
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<DashboardRouteProp>();

  // Handle incoming airportCode from BoardingPassScreen
  useEffect(() => {
    const airportCode = route.params?.airportCode;
    if (airportCode) {
      setInitialAirportCode(airportCode);
      setActiveNav('Lounges');
    }
  }, [route.params?.airportCode]);

  return (
    <View style={styles.container}>
      {/* All screens stay mounted — inactive ones are hidden via display:'none' */}
      <View style={[styles.screenLayer, activeNav !== 'Dashboard' && styles.hidden]}>
        <HomeScreen navigation={navigation} />
      </View>
      <View style={[styles.screenLayer, activeNav !== 'Lounges' && styles.hidden]}>
        <LoungesScreen initialAirportCode={initialAirportCode} />
      </View>
      <View style={[styles.screenLayer, activeNav !== 'Subscriptions' && styles.hidden]}>
        <SubscriptionsScreen />
      </View>
      <View style={[styles.screenLayer, activeNav !== 'Profile' && styles.hidden]}>
        <ProfileScreen />
      </View>

      {/* Floating Bottom Navigation */}
      <View style={styles.navBarContainer}>
        <BlurView intensity={80} tint="light" style={styles.navBar}>
          <Pressable
            style={[styles.navItem, activeNav === 'Dashboard' && styles.navItemActive]}
            onPress={() => setActiveNav('Dashboard')}
          >
            <Ionicons
              name="home"
              size={24}
              color={activeNav === 'Dashboard' ? '#4F46E5' : '#6B7280'}
            />
            <Text style={[styles.navLabel, activeNav === 'Dashboard' && styles.navLabelActive]}>
              Dashboard
            </Text>
          </Pressable>

          <Pressable
            style={[styles.navItem, activeNav === 'Lounges' && styles.navItemActive]}
            onPress={() => setActiveNav('Lounges')}
          >
            <Ionicons
              name="business-outline"
              size={24}
              color={activeNav === 'Lounges' ? '#4F46E5' : '#6B7280'}
            />
            <Text style={[styles.navLabel, activeNav === 'Lounges' && styles.navLabelActive]}>
              Lounges
            </Text>
          </Pressable>

          <Pressable
            style={[styles.navItem, activeNav === 'Subscriptions' && styles.navItemActive]}
            onPress={() => setActiveNav('Subscriptions')}
          >
            <Ionicons
              name="card-outline"
              size={24}
              color={activeNav === 'Subscriptions' ? '#4F46E5' : '#6B7280'}
            />
            <Text style={[styles.navLabel, activeNav === 'Subscriptions' && styles.navLabelActive]}>
              Subscriptions
            </Text>
          </Pressable>

          <Pressable
            style={[styles.navItem, activeNav === 'Profile' && styles.navItemActive]}
            onPress={() => setActiveNav('Profile')}
          >
            <Ionicons
              name="person-outline"
              size={24}
              color={activeNav === 'Profile' ? '#4F46E5' : '#6B7280'}
            />
            <Text style={[styles.navLabel, activeNav === 'Profile' && styles.navLabelActive]}>
              Profile
            </Text>
          </Pressable>
        </BlurView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },
  screenLayer: {
    flex: 1,
  },
  hidden: {
    display: 'none',
  },
  navBarContainer: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
  },
  navBar: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    borderRadius: 40,
    paddingVertical: 12,
    paddingHorizontal: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.8)',
    shadowColor: '#0B1F33',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 12,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 32,
  },
  navItemActive: {
    backgroundColor: '#fff',
  },
  navLabel: {
    color: '#6B7280',
    fontSize: 11,
    marginTop: 4,
    fontFamily: 'SpaceGrotesk_500Medium',
  },
  navLabelActive: {
    color: '#4F46E5',
    fontFamily: 'SpaceGrotesk_700Bold',
  },
});
