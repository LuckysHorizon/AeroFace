import React, { useMemo, useRef, useState } from 'react';
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
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../../lib/supabase';
import { registerLounge } from '../lib/loungeApi';

type AuthMode = 'signin' | 'signup';
type Message = { tone: 'success' | 'error'; text: string } | null;

interface LoungeAuthScreenProps {
    onBack?: () => void;
}

export default function LoungeAuthScreen({ onBack }: LoungeAuthScreenProps) {
    const [mode, setMode] = useState<AuthMode>('signup');
    const [loungeName, setLoungeName] = useState('');
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
            } else {
                if (!loungeName.trim()) {
                    setMessage({ tone: 'error', text: 'Please enter your lounge name.' });
                    setLoading(false);
                    return;
                }

                // 1. Sign up with lounge_admin role in metadata
                const { error: signUpError } = await supabase.auth.signUp({
                    email: email.trim(),
                    password,
                    options: {
                        data: {
                            role: 'lounge_admin',
                            lounge_name: loungeName.trim(),
                        },
                        emailRedirectTo: undefined,
                    },
                });
                if (signUpError) throw signUpError;

                // 2. Auto sign-in immediately (skip email confirmation)
                const { error: signInError } = await supabase.auth.signInWithPassword({
                    email: email.trim(),
                    password,
                });
                if (signInError) throw signInError;

                // 3. Create lounge row in the database linked to this user
                try {
                    await registerLounge({
                        name: loungeName.trim(),
                        airport_name: 'Not Set',
                        airport_code: 'N/A',
                        latitude: 0,
                        longitude: 0,
                    });
                    console.log('[LoungeAuth] Lounge created in database');
                } catch (dbErr) {
                    // Non-fatal: user is signed in, they can set up lounge in Settings
                    console.warn('[LoungeAuth] Could not auto-create lounge:', dbErr);
                }
                // User is now signed in + lounge created → App.tsx routes to LoungePortal
            }
        } catch (err) {
            const error = err as Error;
            setMessage({ tone: 'error', text: error.message || 'Something went wrong.' });
        } finally {
            setLoading(false);
        }
    };

    const isValid = email.trim().length > 3 && password.length >= 6;

    return (
        <LinearGradient colors={['#0f172a', '#111827', '#0b1f3a']} style={s.container}>
            <KeyboardAvoidingView
                style={s.container}
                behavior={Platform.select({ ios: 'padding', android: 'height' })}
            >
                <ScrollView
                    style={s.container}
                    contentContainerStyle={s.scrollContent}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                >
                    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                        <View>
                            {/* Back Button */}
                            {onBack && (
                                <Pressable style={s.backBtn} onPress={onBack}>
                                    <Ionicons name="arrow-back" size={20} color="#94a3b8" />
                                    <Text style={s.backText}>Passenger Login</Text>
                                </Pressable>
                            )}

                            <View style={s.header}>
                                <Text style={s.kicker}>LOUNGE PORTAL</Text>
                                <Text style={s.title}>Register your lounge.</Text>
                                <Text style={s.subtitle}>
                                    Manage memberships, track revenue, and streamline access.
                                </Text>
                            </View>

                            <Animated.View style={[s.card, { opacity: fadeAnim }]}>
                                {/* Segmented Control */}
                                <View style={s.segmented}>
                                    <Pressable
                                        style={[s.segment, mode === 'signin' && s.segmentActive]}
                                        onPress={() => handleModeChange('signin')}
                                    >
                                        <Text style={[s.segmentText, mode === 'signin' && s.segmentTextActive]}>
                                            Sign In
                                        </Text>
                                    </Pressable>
                                    <Pressable
                                        style={[s.segment, mode === 'signup' && s.segmentActive]}
                                        onPress={() => handleModeChange('signup')}
                                    >
                                        <Text style={[s.segmentText, mode === 'signup' && s.segmentTextActive]}>
                                            Register
                                        </Text>
                                    </Pressable>
                                </View>

                                {mode === 'signup' && (
                                    <View style={s.fieldGroup}>
                                        <Text style={s.label}>Lounge Name</Text>
                                        <TextInput
                                            placeholder="e.g. Skyline Premium Lounge"
                                            placeholderTextColor="#8aa0b7"
                                            style={s.input}
                                            value={loungeName}
                                            onChangeText={setLoungeName}
                                            autoCorrect={false}
                                            returnKeyType="next"
                                        />
                                    </View>
                                )}

                                <View style={s.fieldGroup}>
                                    <Text style={s.label}>Email</Text>
                                    <TextInput
                                        placeholder="lounge@aeroface.com"
                                        placeholderTextColor="#8aa0b7"
                                        style={s.input}
                                        value={email}
                                        onChangeText={setEmail}
                                        autoCapitalize="none"
                                        keyboardType="email-address"
                                        autoCorrect={false}
                                        returnKeyType="next"
                                    />
                                </View>

                                <View style={s.fieldGroup}>
                                    <Text style={s.label}>Password</Text>
                                    <TextInput
                                        placeholder="Minimum 6 characters"
                                        placeholderTextColor="#8aa0b7"
                                        style={s.input}
                                        value={password}
                                        onChangeText={setPassword}
                                        secureTextEntry
                                        returnKeyType="done"
                                    />
                                </View>

                                {message && (
                                    <View style={[s.msgBox, message.tone === 'error' ? s.msgError : s.msgSuccess]}>
                                        <Text style={s.msgText}>{message.text}</Text>
                                    </View>
                                )}

                                <Pressable
                                    style={[s.primaryBtn, !isValid && s.primaryBtnDisabled]}
                                    onPress={handleSubmit}
                                    disabled={!isValid || loading}
                                >
                                    {loading ? (
                                        <ActivityIndicator color="#0b1f3a" />
                                    ) : (
                                        <Text style={s.primaryBtnText}>
                                            {mode === 'signin' ? 'Sign In' : 'Create Lounge Account'}
                                        </Text>
                                    )}
                                </Pressable>

                                <View style={s.footer}>
                                    <Text style={s.footerText}>
                                        By registering you agree to AeroFace partner terms and privacy policy.
                                    </Text>
                                </View>
                            </Animated.View>

                            <View style={s.accentRow}>
                                <View style={[s.accentDot, { backgroundColor: accent }]} />
                                <Text style={s.accentText}>
                                    {mode === 'signin' ? 'Lounge owner access' : 'Partner onboarding'}
                                </Text>
                            </View>
                        </View>
                    </TouchableWithoutFeedback>
                </ScrollView>
            </KeyboardAvoidingView>
        </LinearGradient>
    );
}

const s = StyleSheet.create({
    container: { flex: 1 },
    scrollContent: { flexGrow: 1, paddingBottom: 40 },

    backBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        paddingHorizontal: 24, paddingTop: Platform.OS === 'ios' ? 60 : 48,
    },
    backText: { color: '#94a3b8', fontSize: 14, fontFamily: 'SpaceGrotesk_500Medium' },

    header: { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 20 },
    kicker: {
        color: '#94a3b8', fontSize: 14, letterSpacing: 2.4,
        textTransform: 'uppercase', fontFamily: 'SpaceGrotesk_500Medium',
    },
    title: { color: '#f8fafc', fontSize: 32, marginTop: 10, fontFamily: 'SpaceGrotesk_700Bold' },
    subtitle: { color: '#cbd5f5', fontSize: 15, marginTop: 8, lineHeight: 21, fontFamily: 'SpaceGrotesk_400Regular' },

    card: {
        marginHorizontal: 20, backgroundColor: 'rgba(15, 23, 42, 0.92)',
        borderRadius: 24, padding: 22,
        shadowColor: '#0f172a', shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.35, shadowRadius: 18, elevation: 10,
    },

    segmented: { flexDirection: 'row', backgroundColor: '#0b1f3a', borderRadius: 16, padding: 4, marginBottom: 18 },
    segment: { flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center' },
    segmentActive: { backgroundColor: '#f8fafc' },
    segmentText: { color: '#94a3b8', fontFamily: 'SpaceGrotesk_500Medium' },
    segmentTextActive: { color: '#0b1f3a' },

    fieldGroup: { marginBottom: 14 },
    label: {
        color: '#94a3b8', fontSize: 12, letterSpacing: 1.4,
        textTransform: 'uppercase', marginBottom: 8, fontFamily: 'SpaceGrotesk_500Medium',
    },
    input: {
        backgroundColor: '#0f172a', borderRadius: 14,
        paddingHorizontal: 16, paddingVertical: 14,
        color: '#f8fafc', fontSize: 15,
        borderWidth: 1, borderColor: '#1f2937',
        fontFamily: 'SpaceGrotesk_400Regular',
    },

    msgBox: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 12, marginBottom: 14 },
    msgError: { backgroundColor: 'rgba(248,113,113,0.15)', borderWidth: 1, borderColor: 'rgba(248,113,113,0.4)' },
    msgSuccess: { backgroundColor: 'rgba(34,197,94,0.15)', borderWidth: 1, borderColor: 'rgba(34,197,94,0.4)' },
    msgText: { color: '#e2e8f0', fontFamily: 'SpaceGrotesk_400Regular' },

    primaryBtn: { backgroundColor: '#38bdf8', borderRadius: 16, paddingVertical: 14, alignItems: 'center', marginTop: 6 },
    primaryBtnDisabled: { opacity: 0.6 },
    primaryBtnText: { color: '#0b1f3a', fontSize: 16, fontFamily: 'SpaceGrotesk_700Bold' },

    footer: { marginTop: 14 },
    footerText: { color: '#94a3b8', fontSize: 12, lineHeight: 18, fontFamily: 'SpaceGrotesk_400Regular' },

    accentRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, paddingTop: 16 },
    accentDot: { width: 10, height: 10, borderRadius: 999, marginRight: 8 },
    accentText: { color: '#cbd5f5', fontSize: 13, fontFamily: 'SpaceGrotesk_500Medium' },
});
