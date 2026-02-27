import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState, useCallback } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { supabase } from '../lib/supabase';
import { checkFaceStatus, deleteFaceData, FaceStatus } from '../lib/faceApi';
import FaceRegistrationScreen from './FaceRegistrationScreen';

export default function ProfileScreen() {
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<any>(null);

  // Face registration
  const [faceStatus, setFaceStatus] = useState<FaceStatus | null>(null);
  const [faceLoading, setFaceLoading] = useState(true);
  const [showFaceReg, setShowFaceReg] = useState(false);

  useEffect(() => {
    const getUser = async () => {
      const { data } = await supabase.auth.getUser();
      setUser(data.user);
      if (data.user) loadFaceStatus(data.user.id);
    };
    getUser();
  }, []);

  const loadFaceStatus = useCallback(async (userId: string) => {
    setFaceLoading(true);
    try {
      const status = await checkFaceStatus(userId);
      setFaceStatus(status);
    } catch {
      setFaceStatus(null);
    } finally {
      setFaceLoading(false);
    }
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

  const handleReRegister = () => {
    Alert.alert(
      'Update Face Data',
      'This will replace your existing face data with a new capture.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue',
          onPress: async () => {
            try {
              if (faceStatus?.registered && user?.id) {
                await deleteFaceData(user.id);
              }
            } catch { /* continue even if delete fails */ }
            setShowFaceReg(true);
          },
        },
      ],
    );
  };

  const handleFaceRegComplete = () => {
    setShowFaceReg(false);
    if (user?.id) loadFaceStatus(user.id);
    Alert.alert('✅ Face Updated', 'Your face data has been updated successfully.');
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
          </View>

          {/* ── Face Recognition Section ── */}
          <View style={[styles.card, { marginTop: 16 }]}>
            <View style={styles.sectionHeader}>
              <Ionicons name="scan-outline" size={22} color="#3B82F6" />
              <Text style={styles.sectionTitle}>Face Recognition</Text>
            </View>

            {faceLoading ? (
              <View style={styles.faceLoadingRow}>
                <ActivityIndicator size="small" color="#3B82F6" />
                <Text style={styles.faceLoadingText}>Checking face data...</Text>
              </View>
            ) : faceStatus?.registered ? (
              <>
                <View style={styles.faceStatusRow}>
                  <View style={[styles.statusDot, { backgroundColor: '#10B981' }]} />
                  <Text style={[styles.faceStatusText, { color: '#059669' }]}>
                    Face Registered
                  </Text>
                </View>

                {faceStatus.model_name && (
                  <View style={styles.faceDetailRow}>
                    <Text style={styles.faceDetailLabel}>Model</Text>
                    <Text style={styles.faceDetailValue}>{faceStatus.model_name}</Text>
                  </View>
                )}

                {faceStatus.updated_at && (
                  <View style={styles.faceDetailRow}>
                    <Text style={styles.faceDetailLabel}>Last Updated</Text>
                    <Text style={styles.faceDetailValue}>
                      {new Date(faceStatus.updated_at).toLocaleDateString('en-IN', {
                        day: 'numeric', month: 'short', year: 'numeric',
                      })}
                    </Text>
                  </View>
                )}

                <Pressable style={styles.updateFaceBtn} onPress={handleReRegister}>
                  <Ionicons name="refresh-outline" size={18} color="#3B82F6" />
                  <Text style={styles.updateFaceBtnText}>Update Face Data</Text>
                </Pressable>
              </>
            ) : (
              <>
                <View style={styles.faceStatusRow}>
                  <View style={[styles.statusDot, { backgroundColor: '#F59E0B' }]} />
                  <Text style={[styles.faceStatusText, { color: '#D97706' }]}>
                    Not Registered
                  </Text>
                </View>
                <Text style={styles.faceHint}>
                  Register your face for contactless lounge check-in.
                </Text>
                <Pressable style={styles.registerFaceBtn} onPress={() => setShowFaceReg(true)}>
                  <Ionicons name="scan" size={18} color="#FFFFFF" />
                  <Text style={styles.registerFaceBtnText}>Register Face</Text>
                </Pressable>
              </>
            )}
          </View>

          {/* ── Sign Out ── */}
          <View style={[styles.card, { marginTop: 16 }]}>
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

      {/* ── Face Registration Modal ── */}
      <Modal visible={showFaceReg} animationType="slide" presentationStyle="fullScreen">
        <FaceRegistrationScreen
          userId={user?.id || ''}
          onComplete={handleFaceRegComplete}
          onCancel={() => setShowFaceReg(false)}
        />
      </Modal>
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

  // Face Recognition section
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  sectionTitle: {
    color: '#0B1F33',
    fontSize: 18,
    fontFamily: 'SpaceGrotesk_700Bold',
  },
  faceLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
  },
  faceLoadingText: {
    color: '#6B7280',
    fontSize: 14,
    fontFamily: 'SpaceGrotesk_400Regular',
  },
  faceStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  faceStatusText: {
    fontSize: 15,
    fontFamily: 'SpaceGrotesk_600SemiBold',
  },
  faceDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  faceDetailLabel: {
    color: '#9CA3AF',
    fontSize: 13,
    fontFamily: 'SpaceGrotesk_400Regular',
  },
  faceDetailValue: {
    color: '#374151',
    fontSize: 13,
    fontFamily: 'SpaceGrotesk_500Medium',
  },
  faceHint: {
    color: '#6B7280',
    fontSize: 13,
    fontFamily: 'SpaceGrotesk_400Regular',
    marginBottom: 12,
  },
  updateFaceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(59,130,246,0.08)',
    borderRadius: 12,
    paddingVertical: 12,
    marginTop: 12,
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.2)',
  },
  updateFaceBtnText: {
    color: '#3B82F6',
    fontSize: 14,
    fontFamily: 'SpaceGrotesk_600SemiBold',
  },
  registerFaceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#3B82F6',
    borderRadius: 12,
    paddingVertical: 14,
  },
  registerFaceBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: 'SpaceGrotesk_700Bold',
  },

  // Sign out
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(220, 38, 38, 0.08)',
    borderRadius: 16,
    paddingVertical: 14,
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
