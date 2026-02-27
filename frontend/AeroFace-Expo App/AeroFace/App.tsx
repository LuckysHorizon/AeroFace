import { StatusBar } from 'expo-status-bar';
import {
  SpaceGrotesk_400Regular,
  SpaceGrotesk_500Medium,
  SpaceGrotesk_700Bold,
  useFonts,
} from '@expo-google-fonts/space-grotesk';
import { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import type { Session } from '@supabase/supabase-js';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { supabase } from './src/lib/supabase';
import AuthScreen from './src/screens/AuthScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import BoardingPassScreen from './src/screens/BoardingPassScreen';
import SuccessToast from './src/components/SuccessToast';
import LoungeAuthScreen from './src/modules/loungePortal/screens/LoungeAuthScreen';
import LoungePortalDashboard from './src/modules/loungePortal/screens/LoungePortalDashboard';

export type RootStackParamList = {
  Dashboard: { airportCode?: string } | undefined;
  BoardingPassScan: undefined;
  LoungePortal: undefined;
  LoungeAuth: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [showToast, setShowToast] = useState(false);

  const [fontsLoaded] = useFonts({
    SpaceGrotesk_400Regular,
    SpaceGrotesk_500Medium,
    SpaceGrotesk_700Bold,
  });

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);

      // Show toast on sign in
      if (event === 'SIGNED_IN') {
        setShowToast(true);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  if (!fontsLoaded || loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#F5F7FA', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#4F46E5" />
      </View>
    );
  }

  // Determine user role from session metadata
  const userRole = session?.user?.user_metadata?.role;
  const isLoungeAdmin = userRole === 'lounge_admin';

  return (
    <>
      <StatusBar style={session ? 'dark' : 'light'} />
      <SuccessToast
        visible={showToast}
        message="Successfully logged in"
        onHide={() => setShowToast(false)}
      />
      {session ? (
        <NavigationContainer>
          <Stack.Navigator screenOptions={{ headerShown: false }}>
            {isLoungeAdmin ? (
              /* ── Lounge Admin Flow ─── */
              <Stack.Screen name="LoungePortal" component={LoungePortalDashboard} />
            ) : (
              /* ── Passenger Flow ────── */
              <>
                <Stack.Screen name="Dashboard" component={DashboardScreen} />
                <Stack.Screen
                  name="BoardingPassScan"
                  component={BoardingPassScreen}
                  options={{ animation: 'slide_from_right' }}
                />
              </>
            )}
          </Stack.Navigator>
        </NavigationContainer>
      ) : (
        <NavigationContainer>
          <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="Dashboard">
              {() => <AuthScreen onNavigateToLoungeAuth={() => { }} />}
            </Stack.Screen>
            <Stack.Screen name="LoungeAuth">
              {({ navigation }) => (
                <LoungeAuthScreen onBack={() => navigation.goBack()} />
              )}
            </Stack.Screen>
          </Stack.Navigator>
        </NavigationContainer>
      )}
    </>
  );
}
