import { LinearGradient } from 'expo-linear-gradient';
import { useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  Keyboard,
  View,
} from 'react-native';

import { supabase } from '../lib/supabase';

type AuthMode = 'signin' | 'signup';

type Message = {
  tone: 'success' | 'error';
  text: string;
} | null;

const gradients: Record<AuthMode, [string, string, string]> = {
  signin: ['#0f172a', '#111827', '#0b1f3a'],
  signup: ['#102a43', '#0f172a', '#12303f'],
};

export default function AuthScreen() {
  const [mode, setMode] = useState<AuthMode>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<Message>(null);

  const fadeAnim = useRef(new Animated.Value(1)).current;

  const accent = useMemo(() => (mode === 'signin' ? '#38bdf8' : '#22d3ee'), [mode]);

  const handleModeChange = (next: AuthMode) => {
    if (next === mode) return;
    setMessage(null);
    Animated.sequence([
      Animated.timing(fadeAnim, { toValue: 0.2, duration: 140, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
    setMode(next);
  };

  const handleSubmit = async () => {
    setMessage(null);
    setLoading(true);

    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (error) throw error;
        // User will be automatically navigated to Dashboard
      } else {
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { full_name: name.trim() || null },
          },
        });

        if (error) throw error;
        setMessage({
          tone: 'success',
          text: 'Check your email to confirm your account.',
        });
      }
    } catch (err) {
      const error = err as Error;
      setMessage({
        tone: 'error',
        text: error.message || 'Something went wrong. Try again.',
      });
    } finally {
      setLoading(false);
    }
  };

  const isValid = email.trim().length > 3 && password.length >= 6;

  return (
    <LinearGradient colors={gradients[mode]} style={styles.container}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.select({ ios: 'padding', android: 'height' })}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View>
              <View style={styles.header}>
                <Text style={styles.kicker}>AeroFace</Text>
                <Text style={styles.title}>Access your lounge faster.</Text>
                <Text style={styles.subtitle}>
                  Secure biometric boarding starts with a clean sign-in.
                </Text>
              </View>

              <Animated.View style={[styles.card, { opacity: fadeAnim }]}> 
          <View style={styles.segmented}>
            <Pressable
              style={[styles.segment, mode === 'signin' && styles.segmentActive]}
              onPress={() => handleModeChange('signin')}
            >
              <Text style={[styles.segmentText, mode === 'signin' && styles.segmentTextActive]}>
                Sign in
              </Text>
            </Pressable>
            <Pressable
              style={[styles.segment, mode === 'signup' && styles.segmentActive]}
              onPress={() => handleModeChange('signup')}
            >
              <Text style={[styles.segmentText, mode === 'signup' && styles.segmentTextActive]}>
                Sign up
              </Text>
            </Pressable>
          </View>

          {mode === 'signup' ? (
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Full name</Text>
              <TextInput
                placeholder="Ada Lovelace"
                placeholderTextColor="#8aa0b7"
                style={styles.input}
                value={name}
                onChangeText={setName}
                autoCorrect={false}
                returnKeyType="next"
              />
            </View>
          ) : null}

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              placeholder="you@aeroface.com"
              placeholderTextColor="#8aa0b7"
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoCorrect={false}
              returnKeyType="next"
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              placeholder="Minimum 6 characters"
              placeholderTextColor="#8aa0b7"
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              returnKeyType="done"
            />
          </View>

          {message ? (
            <View
              style={[
                styles.message,
                message.tone === 'error' ? styles.messageError : styles.messageSuccess,
              ]}
            >
              <Text style={styles.messageText}>{message.text}</Text>
            </View>
          ) : null}

          <Pressable
            style={[styles.primaryButton, !isValid && styles.primaryButtonDisabled]}
            onPress={handleSubmit}
            disabled={!isValid || loading}
          >
            {loading ? (
              <ActivityIndicator color="#0b1f3a" />
            ) : (
              <Text style={styles.primaryButtonText}>
                {mode === 'signin' ? 'Continue' : 'Create account'}
              </Text>
            )}
          </Pressable>

          <View style={styles.footer}>
            <Text style={styles.footerText}>
              By continuing you agree to AeroFace privacy and safety standards.
            </Text>
          </View>
        </Animated.View>

        <View style={styles.accentRow}>
          <View style={[styles.accentDot, { backgroundColor: accent }]} />
          <Text style={styles.accentText}>
            {mode === 'signin' ? 'Secure sign in' : 'Verified onboarding'}
          </Text>
        </View>
            </View>
          </TouchableWithoutFeedback>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 40,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 64,
    paddingBottom: 20,
  },
  kicker: {
    color: '#94a3b8',
    fontSize: 14,
    letterSpacing: 2.4,
    textTransform: 'uppercase',
    fontFamily: 'SpaceGrotesk_500Medium',
  },
  title: {
    color: '#f8fafc',
    fontSize: 32,
    marginTop: 10,
    fontFamily: 'SpaceGrotesk_700Bold',
  },
  subtitle: {
    color: '#cbd5f5',
    fontSize: 15,
    marginTop: 8,
    lineHeight: 21,
    fontFamily: 'SpaceGrotesk_400Regular',
  },
  card: {
    marginHorizontal: 20,
    backgroundColor: 'rgba(15, 23, 42, 0.92)',
    borderRadius: 24,
    padding: 22,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 10,
  },
  segmented: {
    flexDirection: 'row',
    backgroundColor: '#0b1f3a',
    borderRadius: 16,
    padding: 4,
    marginBottom: 18,
  },
  segment: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
  },
  segmentActive: {
    backgroundColor: '#f8fafc',
  },
  segmentText: {
    color: '#94a3b8',
    fontFamily: 'SpaceGrotesk_500Medium',
  },
  segmentTextActive: {
    color: '#0b1f3a',
  },
  fieldGroup: {
    marginBottom: 14,
  },
  label: {
    color: '#94a3b8',
    fontSize: 12,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    marginBottom: 8,
    fontFamily: 'SpaceGrotesk_500Medium',
  },
  input: {
    backgroundColor: '#0f172a',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: '#f8fafc',
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#1f2937',
    fontFamily: 'SpaceGrotesk_400Regular',
  },
  message: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    marginBottom: 14,
  },
  messageError: {
    backgroundColor: 'rgba(248, 113, 113, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(248, 113, 113, 0.4)',
  },
  messageSuccess: {
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.4)',
  },
  messageText: {
    color: '#e2e8f0',
    fontFamily: 'SpaceGrotesk_400Regular',
  },
  primaryButton: {
    backgroundColor: '#38bdf8',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 6,
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: '#0b1f3a',
    fontSize: 16,
    fontFamily: 'SpaceGrotesk_700Bold',
  },
  footer: {
    marginTop: 14,
  },
  footerText: {
    color: '#94a3b8',
    fontSize: 12,
    lineHeight: 18,
    fontFamily: 'SpaceGrotesk_400Regular',
  },
  accentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  accentDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    marginRight: 8,
  },
  accentText: {
    color: '#cbd5f5',
    fontSize: 13,
    fontFamily: 'SpaceGrotesk_500Medium',
  },
});
