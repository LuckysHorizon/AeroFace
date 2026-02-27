import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../../lib/supabase';
import { getOwnerLounge, updateLoungeProfile, registerLounge, LoungeProfile } from '../lib/loungeApi';

export default function LoungeSettingsScreen() {
    const [lounge, setLounge] = useState<LoungeProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [signingOut, setSigningOut] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMsg, setSuccessMsg] = useState<string | null>(null);

    // Editable fields
    const [name, setName] = useState('');
    const [airportCode, setAirportCode] = useState('');
    const [airportName, setAirportName] = useState('');
    const [terminal, setTerminal] = useState('');
    const [capacity, setCapacity] = useState('50');
    const [description, setDescription] = useState('');
    const [isRegistering, setIsRegistering] = useState(false);

    useEffect(() => { loadLounge(); }, []);

    async function loadLounge() {
        try {
            setLoading(true);
            setError(null);
            const data = await getOwnerLounge();
            if (data) {
                setLounge(data);
                setName(data.name);
                setAirportCode(data.airport_code || '');
                setAirportName(data.airport_name || '');
                setTerminal(data.terminal || '');
                setCapacity(String(data.capacity || 50));
                setDescription(data.description || '');
            } else {
                // No lounge yet — show registration form
                setIsRegistering(true);
                const { data: { user } } = await supabase.auth.getUser();
                if (user?.user_metadata?.lounge_name) {
                    setName(user.user_metadata.lounge_name);
                }
            }
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }

    async function handleSave() {
        try {
            setSaving(true);
            setError(null);
            setSuccessMsg(null);

            if (isRegistering) {
                if (!name.trim() || !airportCode.trim()) {
                    setError('Lounge name and airport code are required.');
                    return;
                }
                const newLounge = await registerLounge({
                    name: name.trim(),
                    airport_name: airportName.trim() || airportCode.trim() + ' Airport',
                    airport_code: airportCode.trim().toUpperCase(),
                    terminal: terminal.trim() || undefined,
                    latitude: 0,
                    longitude: 0,
                    capacity: parseInt(capacity) || 50,
                    description: description.trim() || undefined,
                });
                setLounge(newLounge);
                setIsRegistering(false);
                setSuccessMsg('Lounge registered successfully!');
            } else if (lounge) {
                const updated = await updateLoungeProfile(lounge.id, {
                    name: name.trim(),
                    airport_name: airportName.trim(),
                    airport_code: airportCode.trim().toUpperCase(),
                    terminal: terminal.trim(),
                    capacity: parseInt(capacity) || 50,
                    description: description.trim(),
                });
                setLounge(updated);
                setSuccessMsg('Settings saved!');
            }
        } catch (e: any) {
            setError(e.message);
        } finally {
            setSaving(false);
        }
    }

    async function handleSignOut() {
        setSigningOut(true);
        try { await supabase.auth.signOut(); } catch (e) { console.error(e); }
        setSigningOut(false);
    }

    if (loading) {
        return (
            <View style={[s.container, s.center]}>
                <ActivityIndicator size="large" color="#10B981" />
            </View>
        );
    }

    return (
        <View style={s.container}>
            <LinearGradient colors={['#ECFDF5', '#F0FDF4', '#FFFFFF']} style={s.gradient}>
                <ScrollView
                    contentContainerStyle={s.scrollContent}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                >
                    <View style={s.header}>
                        <Text style={s.kicker}>
                            {isRegistering ? 'REGISTER LOUNGE' : 'SETTINGS'}
                        </Text>
                        <Text style={s.title}>
                            {isRegistering ? 'Setup Your Lounge' : 'Lounge Settings'}
                        </Text>
                        <Text style={s.subtitle}>
                            {isRegistering
                                ? 'Complete your lounge profile to get started.'
                                : 'Manage your lounge profile and preferences.'}
                        </Text>
                    </View>

                    <View style={s.card}>
                        <Field label="Lounge Name" value={name} onChangeText={setName} placeholder="e.g. Skyline Premium Lounge" />
                        <Field label="Airport Code" value={airportCode} onChangeText={setAirportCode} placeholder="e.g. HYD" autoCapitalize="characters" />
                        <Field label="Airport Name" value={airportName} onChangeText={setAirportName} placeholder="e.g. Rajiv Gandhi International" />
                        <Field label="Terminal" value={terminal} onChangeText={setTerminal} placeholder="e.g. Terminal 1" />
                        <Field label="Capacity" value={capacity} onChangeText={setCapacity} placeholder="50" keyboardType="numeric" />
                        <Field label="Description" value={description} onChangeText={setDescription} placeholder="Describe your lounge..." multiline />

                        {error && (
                            <View style={s.errorBox}>
                                <Text style={s.errorText}>{error}</Text>
                            </View>
                        )}

                        {successMsg && (
                            <View style={s.successBox}>
                                <Ionicons name="checkmark-circle" size={16} color="#15803D" />
                                <Text style={s.successText}>{successMsg}</Text>
                            </View>
                        )}

                        <Pressable style={[s.saveBtn, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving}>
                            {saving ? (
                                <ActivityIndicator color="#022c22" />
                            ) : (
                                <Text style={s.saveBtnText}>
                                    {isRegistering ? 'Register Lounge' : 'Save Changes'}
                                </Text>
                            )}
                        </Pressable>
                    </View>

                    {/* Sign Out */}
                    <Pressable
                        style={[s.signOutBtn, signingOut && { opacity: 0.6 }]}
                        onPress={handleSignOut}
                        disabled={signingOut}
                    >
                        {signingOut ? (
                            <ActivityIndicator color="#DC2626" />
                        ) : (
                            <>
                                <Ionicons name="log-out-outline" size={20} color="#DC2626" />
                                <Text style={s.signOutText}>Sign Out</Text>
                            </>
                        )}
                    </Pressable>

                    <View style={{ height: 120 }} />
                </ScrollView>
            </LinearGradient>
        </View>
    );
}

// ── Reusable Field ────────────────────────────────────────────────
function Field({ label, value, onChangeText, placeholder, multiline, keyboardType, autoCapitalize }: {
    label: string;
    value: string;
    onChangeText: (t: string) => void;
    placeholder?: string;
    multiline?: boolean;
    keyboardType?: 'default' | 'numeric';
    autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
}) {
    return (
        <View style={s.fieldGroup}>
            <Text style={s.label}>{label}</Text>
            <TextInput
                style={[s.input, multiline && { height: 80, textAlignVertical: 'top' }]}
                value={value}
                onChangeText={onChangeText}
                placeholder={placeholder}
                placeholderTextColor="#9CA3AF"
                multiline={multiline}
                keyboardType={keyboardType}
                autoCapitalize={autoCapitalize}
            />
        </View>
    );
}

const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F0FDF4' },
    gradient: { flex: 1 },
    center: { alignItems: 'center', justifyContent: 'center' },
    scrollContent: { paddingTop: Platform.OS === 'ios' ? 60 : 50, paddingHorizontal: 20 },

    header: { marginBottom: 20 },
    kicker: { color: '#059669', fontSize: 12, letterSpacing: 2, fontFamily: 'SpaceGrotesk_500Medium', marginBottom: 4 },
    title: { color: '#022c22', fontSize: 28, fontFamily: 'SpaceGrotesk_700Bold' },
    subtitle: { color: '#6B7280', fontSize: 14, fontFamily: 'SpaceGrotesk_400Regular', marginTop: 4 },

    card: {
        backgroundColor: '#FFFFFF', borderRadius: 20, padding: 20,
        shadowColor: '#022c22', shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06, shadowRadius: 10, elevation: 3,
    },

    fieldGroup: { marginBottom: 16 },
    label: { color: '#374151', fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6, fontFamily: 'SpaceGrotesk_500Medium' },
    input: {
        backgroundColor: '#F9FAFB', borderRadius: 12, paddingHorizontal: 14,
        paddingVertical: 12, color: '#022c22', fontSize: 15, borderWidth: 1,
        borderColor: '#E5E7EB', fontFamily: 'SpaceGrotesk_400Regular',
    },

    errorBox: { backgroundColor: '#FEF2F2', borderRadius: 12, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: '#FECACA' },
    errorText: { color: '#DC2626', fontSize: 13, fontFamily: 'SpaceGrotesk_400Regular' },

    successBox: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#F0FDF4', borderRadius: 12, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: '#BBF7D0' },
    successText: { color: '#15803D', fontSize: 13, fontFamily: 'SpaceGrotesk_400Regular' },

    saveBtn: { backgroundColor: '#10B981', borderRadius: 16, paddingVertical: 14, alignItems: 'center', marginTop: 4 },
    saveBtnText: { color: '#022c22', fontSize: 16, fontFamily: 'SpaceGrotesk_700Bold' },

    signOutBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
        backgroundColor: '#FFFFFF', borderRadius: 16, paddingVertical: 14, marginTop: 20,
        borderWidth: 1, borderColor: '#FECACA',
        shadowColor: '#022c22', shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
    },
    signOutText: { color: '#DC2626', fontSize: 15, fontFamily: 'SpaceGrotesk_700Bold' },
});
