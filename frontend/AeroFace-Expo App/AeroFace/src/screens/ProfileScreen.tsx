import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { supabase } from '../lib/supabase';

export default function ProfileScreen() {
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const getUser = async () => {
      const { data } = await supabase.auth.getUser();
      setUser(data.user);
    };
    getUser();
  }, []);

  const handleSignOut = async () => {
    setLoading(true);
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Sign out error:', error);
    } finally {
      setLoading(false);
    }
  };

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
        >
          <View style={styles.header}>
            <Text style={styles.kicker}>PROFILE</Text>
            <Text style={styles.title}>Account Settings</Text>
            <Text style={styles.subtitle}>Manage your account and preferences.</Text>
          </View>

          <View style={styles.card}>
            <View style={styles.profileHeader}>
              <View style={styles.avatarCircle}>
                <Ionicons name="person" size={40} color="#4F46E5" />
              </View>
            </View>

            {user?.email && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Email</Text>
                <Text style={styles.infoValue}>{user.email}</Text>
              </View>
            )}

            {user?.user_metadata?.full_name && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Full Name</Text>
                <Text style={styles.infoValue}>{user.user_metadata.full_name}</Text>
              </View>
            )}

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>User ID</Text>
              <Text style={styles.infoValue} numberOfLines={1}>
                {user?.id || 'Loading...'}
              </Text>
            </View>

            <Pressable
              style={[styles.signOutButton, loading && styles.signOutButtonDisabled]}
              onPress={handleSignOut}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#DC2626" />
              ) : (
                <>
                  <Ionicons name="log-out-outline" size={20} color="#DC2626" />
                  <Text style={styles.signOutButtonText}>Sign Out</Text>
                </>
              )}
            </Pressable>
          </View>
        </ScrollView>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },
  gradientBg: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 60,
    paddingBottom: 120,
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
  card: {
    marginHorizontal: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    shadowColor: '#0B1F33',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  profileHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  avatarCircle: {
    width: 96,
    height: 96,
    borderRadius: 999,
    backgroundColor: 'rgba(79, 70, 229, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoRow: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  infoLabel: {
    color: '#6B7280',
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 6,
    fontFamily: 'SpaceGrotesk_500Medium',
  },
  infoValue: {
    color: '#0B1F33',
    fontSize: 15,
    fontFamily: 'SpaceGrotesk_400Regular',
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(220, 38, 38, 0.08)',
    borderRadius: 16,
    paddingVertical: 14,
    marginTop: 24,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(220, 38, 38, 0.2)',
  },
  signOutButtonDisabled: {
    opacity: 0.6,
  },
  signOutButtonText: {
    color: '#DC2626',
    fontSize: 15,
    fontFamily: 'SpaceGrotesk_700Bold',
  },
});
