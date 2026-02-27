import React, { useEffect, useState, useCallback } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Keyboard,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    TouchableWithoutFeedback,
    View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import {
    getOwnerLounge,
    getPlans,
    addPlan,
    updatePlan,
    deletePlan,
    LoungePlan,
} from '../lib/loungeApi';

const DURATION_PRESETS = [
    { label: '1 Week', days: 7 },
    { label: '1 Month', days: 30 },
    { label: '3 Months', days: 90 },
    { label: '6 Months', days: 180 },
    { label: '1 Year', days: 365 },
];

export default function LoungePlansScreen() {
    const [plans, setPlans] = useState<LoungePlan[]>([]);
    const [loungeId, setLoungeId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Modal state
    const [showModal, setShowModal] = useState(false);
    const [editingPlan, setEditingPlan] = useState<LoungePlan | null>(null);
    const [planName, setPlanName] = useState('');
    const [planDesc, setPlanDesc] = useState('');
    const [planPrice, setPlanPrice] = useState('');
    const [planDuration, setPlanDuration] = useState(30);
    const [planFeatures, setPlanFeatures] = useState('');
    const [planActive, setPlanActive] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => { loadData(); }, []);

    async function loadData() {
        try {
            setError(null);
            if (!refreshing) setLoading(true);
            const lounge = await getOwnerLounge();
            if (!lounge) { setError('No lounge registered.'); return; }
            setLoungeId(lounge.id);
            const data = await getPlans(lounge.id);
            setPlans(data);
        } catch (e: any) {
            setError(e.message || 'Failed to load plans');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }

    const onRefresh = useCallback(() => { setRefreshing(true); loadData(); }, []);

    const openCreateModal = () => {
        setEditingPlan(null);
        setPlanName('');
        setPlanDesc('');
        setPlanPrice('');
        setPlanDuration(30);
        setPlanFeatures('');
        setPlanActive(true);
        setShowModal(true);
    };

    const openEditModal = (plan: LoungePlan) => {
        setEditingPlan(plan);
        setPlanName(plan.name);
        setPlanDesc(plan.description || '');
        setPlanPrice(String(plan.price));
        setPlanDuration(plan.duration_days);
        setPlanFeatures((plan.features || []).join(', '));
        setPlanActive(plan.is_active);
        setShowModal(true);
    };

    const handleSave = async () => {
        if (!loungeId || !planName.trim() || !planPrice.trim()) return;
        const price = parseFloat(planPrice);
        if (isNaN(price) || price < 0) {
            Alert.alert('Invalid', 'Please enter a valid price.');
            return;
        }

        const featuresArr = planFeatures
            .split(',')
            .map(f => f.trim())
            .filter(Boolean);

        try {
            setSaving(true);
            if (editingPlan) {
                const updated = await updatePlan(editingPlan.id, {
                    name: planName.trim(),
                    description: planDesc.trim() || undefined,
                    price,
                    duration_days: planDuration,
                    features: featuresArr,
                    is_active: planActive,
                });
                setPlans(prev => prev.map(p => p.id === updated.id ? updated : p));
            } else {
                const created = await addPlan({
                    lounge_id: loungeId,
                    name: planName.trim(),
                    description: planDesc.trim() || undefined,
                    price,
                    duration_days: planDuration,
                    features: featuresArr,
                });
                setPlans(prev => [...prev, created].sort((a, b) => a.price - b.price));
            }
            setShowModal(false);
        } catch (e: any) {
            const msg = e.message || '';
            if (msg.includes('duplicate') || msg.includes('unique')) {
                Alert.alert('Duplicate', 'A plan with this name already exists for your lounge.');
            } else {
                Alert.alert('Error', msg || 'Failed to save plan');
            }
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = (plan: LoungePlan) => {
        Alert.alert(
            'Delete Plan',
            `Are you sure you want to delete "${plan.name}"? This cannot be undone.`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await deletePlan(plan.id);
                            setPlans(prev => prev.filter(p => p.id !== plan.id));
                        } catch (e: any) {
                            Alert.alert('Error', e.message || 'Failed to delete plan');
                        }
                    },
                },
            ]
        );
    };

    const handleToggleActive = async (plan: LoungePlan) => {
        try {
            const updated = await updatePlan(plan.id, { is_active: !plan.is_active });
            setPlans(prev => prev.map(p => p.id === updated.id ? updated : p));
        } catch (e: any) {
            Alert.alert('Error', e.message || 'Failed to update plan');
        }
    };

    const formatCurrency = (val: number) =>
        '₹' + val.toLocaleString('en-IN', { maximumFractionDigits: 0 });

    const formatDuration = (days: number) => {
        if (days >= 365) return `${Math.floor(days / 365)} Year${days >= 730 ? 's' : ''}`;
        if (days >= 30) return `${Math.floor(days / 30)} Month${days >= 60 ? 's' : ''}`;
        if (days >= 7) return `${Math.floor(days / 7)} Week${days >= 14 ? 's' : ''}`;
        return `${days} Day${days !== 1 ? 's' : ''}`;
    };

    function renderPlan({ item }: { item: LoungePlan }) {
        return (
            <View style={[s.planCard, !item.is_active && s.planCardInactive]}>
                {/* Header */}
                <View style={s.planHeader}>
                    <View style={{ flex: 1 }}>
                        <View style={s.planNameRow}>
                            <Text style={s.planName}>{item.name}</Text>
                            {!item.is_active && (
                                <View style={s.inactiveBadge}>
                                    <Text style={s.inactiveBadgeText}>Inactive</Text>
                                </View>
                            )}
                        </View>
                        {item.description && (
                            <Text style={s.planDesc} numberOfLines={2}>{item.description}</Text>
                        )}
                    </View>
                </View>

                {/* Price & Duration */}
                <View style={s.priceRow}>
                    <View style={s.priceBox}>
                        <Text style={s.priceLabel}>PRICE</Text>
                        <Text style={s.priceValue}>{formatCurrency(Number(item.price))}</Text>
                    </View>
                    <View style={s.priceBox}>
                        <Text style={s.priceLabel}>DURATION</Text>
                        <Text style={s.priceValue}>{formatDuration(item.duration_days)}</Text>
                    </View>
                    <View style={s.priceBox}>
                        <Text style={s.priceLabel}>CURRENCY</Text>
                        <Text style={s.priceValue}>{item.currency}</Text>
                    </View>
                </View>

                {/* Features */}
                {item.features && item.features.length > 0 && (
                    <View style={s.featuresWrap}>
                        {item.features.map((feat, idx) => (
                            <View key={idx} style={s.featureChip}>
                                <Ionicons name="checkmark-circle" size={14} color="#10B981" />
                                <Text style={s.featureText}>{feat}</Text>
                            </View>
                        ))}
                    </View>
                )}

                {/* Actions */}
                <View style={s.planActions}>
                    <Pressable style={s.planActionBtn} onPress={() => handleToggleActive(item)}>
                        <Ionicons
                            name={item.is_active ? 'pause-circle-outline' : 'play-circle-outline'}
                            size={18}
                            color={item.is_active ? '#F59E0B' : '#10B981'}
                        />
                        <Text style={[s.planActionText, { color: item.is_active ? '#F59E0B' : '#10B981' }]}>
                            {item.is_active ? 'Deactivate' : 'Activate'}
                        </Text>
                    </Pressable>
                    <Pressable style={s.planActionBtn} onPress={() => openEditModal(item)}>
                        <Ionicons name="create-outline" size={18} color="#3B82F6" />
                        <Text style={[s.planActionText, { color: '#3B82F6' }]}>Edit</Text>
                    </Pressable>
                    <Pressable style={s.planActionBtn} onPress={() => handleDelete(item)}>
                        <Ionicons name="trash-outline" size={18} color="#DC2626" />
                        <Text style={[s.planActionText, { color: '#DC2626' }]}>Delete</Text>
                    </Pressable>
                </View>
            </View>
        );
    }

    return (
        <View style={s.container}>
            <LinearGradient colors={['#ECFDF5', '#F0FDF4', '#FFFFFF']} style={s.gradient}>
                <View style={s.headerWrap}>
                    <View style={s.headerRow}>
                        <View style={{ flex: 1 }}>
                            <Text style={s.kicker}>PRICING MANAGEMENT</Text>
                            <Text style={s.title}>Subscription Plans</Text>
                            <Text style={s.subtitle}>
                                {plans.length > 0
                                    ? `${plans.length} plan${plans.length !== 1 ? 's' : ''} created`
                                    : 'Create your first membership plan'}
                            </Text>
                        </View>
                        <Pressable style={s.addFab} onPress={openCreateModal}>
                            <Ionicons name="add" size={24} color="#FFFFFF" />
                        </Pressable>
                    </View>
                </View>

                {loading && (
                    <View style={s.center}>
                        <ActivityIndicator size="large" color="#10B981" />
                        <Text style={s.centerText}>Loading plans...</Text>
                    </View>
                )}

                {error && !loading && (
                    <View style={s.center}>
                        <Ionicons name="alert-circle-outline" size={48} color="#DC2626" />
                        <Text style={s.centerText}>{error}</Text>
                    </View>
                )}

                {!loading && !error && plans.length === 0 && (
                    <View style={s.center}>
                        <View style={s.emptyIcon}>
                            <Ionicons name="pricetags-outline" size={48} color="#10B981" />
                        </View>
                        <Text style={s.emptyTitle}>No plans yet</Text>
                        <Text style={s.emptySubtitle}>
                            Tap '+' to create your first subscription plan with INR pricing.
                        </Text>
                    </View>
                )}

                {!loading && !error && plans.length > 0 && (
                    <FlatList
                        data={plans}
                        keyExtractor={item => item.id}
                        renderItem={renderPlan}
                        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 120 }}
                        showsVerticalScrollIndicator={false}
                        refreshControl={
                            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#10B981" colors={['#10B981']} />
                        }
                    />
                )}

                {/* ── Create / Edit Modal ── */}
                <Modal visible={showModal} animationType="slide" transparent>
                    <KeyboardAvoidingView
                        style={{ flex: 1 }}
                        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    >
                        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                            <View style={s.modalOverlay}>
                                <View style={s.modalCard}>
                                    <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                                        <View style={s.modalHeader}>
                                            <Text style={s.modalTitle}>
                                                {editingPlan ? 'Edit Plan' : 'Create Plan'}
                                            </Text>
                                            <Pressable onPress={() => setShowModal(false)}>
                                                <Ionicons name="close" size={24} color="#6B7280" />
                                            </Pressable>
                                        </View>

                                        <View style={s.fieldGroup}>
                                            <Text style={s.label}>Plan Name *</Text>
                                            <TextInput
                                                style={s.input}
                                                value={planName}
                                                onChangeText={setPlanName}
                                                placeholder="e.g. Premium Monthly"
                                                placeholderTextColor="#9CA3AF"
                                            />
                                        </View>

                                        <View style={s.fieldGroup}>
                                            <Text style={s.label}>Price (₹ INR) *</Text>
                                            <TextInput
                                                style={s.input}
                                                value={planPrice}
                                                onChangeText={setPlanPrice}
                                                placeholder="2999"
                                                placeholderTextColor="#9CA3AF"
                                                keyboardType="numeric"
                                            />
                                        </View>

                                        <View style={s.fieldGroup}>
                                            <Text style={s.label}>Duration</Text>
                                            <View style={s.durationRow}>
                                                {DURATION_PRESETS.map(d => (
                                                    <Pressable
                                                        key={d.days}
                                                        style={[s.durationChip, planDuration === d.days && s.durationChipActive]}
                                                        onPress={() => setPlanDuration(d.days)}
                                                    >
                                                        <Text style={[s.durationChipText, planDuration === d.days && s.durationChipTextActive]}>
                                                            {d.label}
                                                        </Text>
                                                    </Pressable>
                                                ))}
                                            </View>
                                        </View>

                                        <View style={s.fieldGroup}>
                                            <Text style={s.label}>Description</Text>
                                            <TextInput
                                                style={[s.input, { height: 80, textAlignVertical: 'top' }]}
                                                value={planDesc}
                                                onChangeText={setPlanDesc}
                                                placeholder="What's included in this plan"
                                                placeholderTextColor="#9CA3AF"
                                                multiline
                                            />
                                        </View>

                                        <View style={s.fieldGroup}>
                                            <Text style={s.label}>Features (comma-separated)</Text>
                                            <TextInput
                                                style={s.input}
                                                value={planFeatures}
                                                onChangeText={setPlanFeatures}
                                                placeholder="WiFi, Food, Drinks, Shower"
                                                placeholderTextColor="#9CA3AF"
                                            />
                                        </View>

                                        {editingPlan && (
                                            <View style={s.toggleRow}>
                                                <Text style={s.toggleLabel}>Active</Text>
                                                <Switch
                                                    value={planActive}
                                                    onValueChange={setPlanActive}
                                                    trackColor={{ true: '#10B981', false: '#D1D5DB' }}
                                                    thumbColor="#FFFFFF"
                                                />
                                            </View>
                                        )}

                                        <Pressable
                                            style={[s.modalSaveBtn, saving && { opacity: 0.6 }]}
                                            onPress={handleSave}
                                            disabled={saving || !planName.trim() || !planPrice.trim()}
                                        >
                                            {saving ? (
                                                <ActivityIndicator color="#FFFFFF" />
                                            ) : (
                                                <Text style={s.modalSaveBtnText}>
                                                    {editingPlan ? 'Save Changes' : 'Create Plan'}
                                                </Text>
                                            )}
                                        </Pressable>
                                    </ScrollView>
                                </View>
                            </View>
                        </TouchableWithoutFeedback>
                    </KeyboardAvoidingView>
                </Modal>
            </LinearGradient>
        </View>
    );
}

const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F0FDF4' },
    gradient: { flex: 1 },

    headerWrap: { paddingTop: Platform.OS === 'ios' ? 60 : 50, paddingHorizontal: 20, paddingBottom: 16 },
    headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
    kicker: { color: '#059669', fontSize: 12, letterSpacing: 2, fontFamily: 'SpaceGrotesk_500Medium', marginBottom: 4 },
    title: { color: '#022c22', fontSize: 28, fontFamily: 'SpaceGrotesk_700Bold' },
    subtitle: { color: '#6B7280', fontSize: 14, fontFamily: 'SpaceGrotesk_400Regular', marginTop: 4 },

    addFab: {
        width: 48, height: 48, borderRadius: 16, backgroundColor: '#059669',
        alignItems: 'center', justifyContent: 'center', marginTop: 8,
        shadowColor: '#059669', shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3, shadowRadius: 8, elevation: 6,
    },

    center: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 12 },
    centerText: { color: '#6B7280', fontSize: 14, fontFamily: 'SpaceGrotesk_400Regular' },

    emptyIcon: {
        width: 96, height: 96, borderRadius: 999,
        backgroundColor: 'rgba(16,185,129,0.1)', alignItems: 'center', justifyContent: 'center',
    },
    emptyTitle: { color: '#022c22', fontSize: 20, fontFamily: 'SpaceGrotesk_700Bold' },
    emptySubtitle: { color: '#6B7280', fontSize: 14, fontFamily: 'SpaceGrotesk_400Regular', textAlign: 'center', paddingHorizontal: 40 },

    // Plan Cards
    planCard: {
        backgroundColor: '#FFFFFF', borderRadius: 20, padding: 18, marginBottom: 14,
        shadowColor: '#022c22', shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06, shadowRadius: 10, elevation: 3,
    },
    planCardInactive: { opacity: 0.65 },

    planHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 14 },
    planNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
    planName: { color: '#022c22', fontSize: 20, fontFamily: 'SpaceGrotesk_700Bold' },
    planDesc: { color: '#6B7280', fontSize: 13, fontFamily: 'SpaceGrotesk_400Regular', marginTop: 4, lineHeight: 19 },

    inactiveBadge: { backgroundColor: '#FEF3C7', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
    inactiveBadgeText: { color: '#92400E', fontSize: 11, fontFamily: 'SpaceGrotesk_500Medium' },

    priceRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
    priceBox: {
        flex: 1, backgroundColor: '#F9FAFB', borderRadius: 14, padding: 12,
        alignItems: 'center', borderWidth: 1, borderColor: '#F3F4F6',
    },
    priceLabel: { color: '#9CA3AF', fontSize: 10, letterSpacing: 1.2, fontFamily: 'SpaceGrotesk_500Medium', marginBottom: 4 },
    priceValue: { color: '#022c22', fontSize: 16, fontFamily: 'SpaceGrotesk_700Bold' },

    featuresWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 14 },
    featureChip: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        backgroundColor: '#ECFDF5', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10,
    },
    featureText: { color: '#065F46', fontSize: 12, fontFamily: 'SpaceGrotesk_400Regular' },

    planActions: { flexDirection: 'row', gap: 8, borderTopWidth: 1, borderTopColor: '#F3F4F6', paddingTop: 12 },
    planActionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 8, borderRadius: 10, backgroundColor: '#F9FAFB' },
    planActionText: { fontSize: 12, fontFamily: 'SpaceGrotesk_500Medium' },

    // Modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalCard: {
        backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24,
        padding: 24, paddingBottom: Platform.OS === 'ios' ? 40 : 24,
        maxHeight: '85%',
    },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    modalTitle: { color: '#022c22', fontSize: 22, fontFamily: 'SpaceGrotesk_700Bold' },

    fieldGroup: { marginBottom: 16 },
    label: { color: '#374151', fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6, fontFamily: 'SpaceGrotesk_500Medium' },
    input: {
        backgroundColor: '#F9FAFB', borderRadius: 12, paddingHorizontal: 14,
        paddingVertical: 12, color: '#022c22', fontSize: 15, borderWidth: 1,
        borderColor: '#E5E7EB', fontFamily: 'SpaceGrotesk_400Regular',
    },
    durationRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    durationChip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#F9FAFB' },
    durationChipActive: { backgroundColor: '#059669', borderColor: '#059669' },
    durationChipText: { fontSize: 13, fontFamily: 'SpaceGrotesk_500Medium', color: '#6B7280' },
    durationChipTextActive: { color: '#FFFFFF' },

    toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    toggleLabel: { color: '#374151', fontSize: 15, fontFamily: 'SpaceGrotesk_500Medium' },

    modalSaveBtn: { backgroundColor: '#059669', borderRadius: 16, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
    modalSaveBtnText: { color: '#FFFFFF', fontSize: 16, fontFamily: 'SpaceGrotesk_700Bold' },
});
