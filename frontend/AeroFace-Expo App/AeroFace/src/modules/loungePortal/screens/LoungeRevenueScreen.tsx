import React, { useEffect, useState, useCallback } from 'react';
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
    TextInput,
    View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import {
    getOwnerLounge,
    getTransactions,
    addTransaction,
    deleteTransaction,
    Transaction,
    Period,
} from '../lib/loungeApi';

const PERIODS: { label: string; value: Period }[] = [
    { label: 'Today', value: 'today' },
    { label: 'Week', value: 'week' },
    { label: 'Month', value: 'month' },
    { label: 'All Time', value: 'all' },
];

const TX_TYPES: { label: string; value: 'booking' | 'membership' | 'walk_in' | 'refund' }[] = [
    { label: 'Booking', value: 'booking' },
    { label: 'Membership', value: 'membership' },
    { label: 'Walk-in', value: 'walk_in' },
    { label: 'Refund', value: 'refund' },
];

const TYPE_ICONS: Record<string, string> = {
    booking: 'airplane-outline',
    membership: 'card-outline',
    walk_in: 'walk-outline',
    refund: 'return-down-back-outline',
};

export default function LoungeRevenueScreen() {
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loungeId, setLoungeId] = useState<string | null>(null);
    const [period, setPeriod] = useState<Period>('month');
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Add Transaction Modal
    const [showAddModal, setShowAddModal] = useState(false);
    const [txAmount, setTxAmount] = useState('');
    const [txType, setTxType] = useState<'booking' | 'membership' | 'walk_in' | 'refund'>('booking');
    const [txDesc, setTxDesc] = useState('');
    const [addLoading, setAddLoading] = useState(false);

    useEffect(() => { loadData(); }, [period]);

    async function loadData() {
        try {
            setError(null);
            if (!refreshing) setLoading(true);
            const lounge = await getOwnerLounge();
            if (!lounge) { setError('No lounge registered.'); return; }
            setLoungeId(lounge.id);
            const data = await getTransactions(lounge.id, period);
            setTransactions(data);
        } catch (e: any) {
            setError(e.message || 'Failed to load transactions');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }

    const onRefresh = useCallback(() => { setRefreshing(true); loadData(); }, [period]);

    const totalRevenue = transactions
        .filter(t => t.status === 'completed' && t.transaction_type !== 'refund')
        .reduce((sum, t) => sum + Number(t.amount), 0);

    const totalRefunds = transactions
        .filter(t => t.transaction_type === 'refund')
        .reduce((sum, t) => sum + Number(t.amount), 0);

    const formatCurrency = (val: number) =>
        '₹' + val.toLocaleString('en-IN', { maximumFractionDigits: 0 });

    const handleAddTransaction = async () => {
        if (!loungeId || !txAmount.trim()) return;
        const amount = parseFloat(txAmount);
        if (isNaN(amount) || amount <= 0) {
            Alert.alert('Invalid', 'Please enter a valid amount.');
            return;
        }
        try {
            setAddLoading(true);
            const newTx = await addTransaction({
                lounge_id: loungeId,
                amount,
                transaction_type: txType,
                description: txDesc.trim() || undefined,
            });
            setTransactions(prev => [newTx, ...prev]);
            setTxAmount('');
            setTxType('booking');
            setTxDesc('');
            setShowAddModal(false);
        } catch (e: any) {
            Alert.alert('Error', e.message || 'Failed to add transaction');
        } finally {
            setAddLoading(false);
        }
    };

    const handleDelete = (txId: string) => {
        Alert.alert(
            'Delete Transaction',
            'Are you sure you want to delete this transaction?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await deleteTransaction(txId, loungeId || undefined);
                            setTransactions(prev => prev.filter(t => t.id !== txId));
                        } catch (e: any) {
                            Alert.alert('Error', e.message || 'Failed to delete');
                        }
                    },
                },
            ]
        );
    };

    function renderTransaction({ item }: { item: Transaction }) {
        const isRefund = item.transaction_type === 'refund';
        return (
            <View style={s.txCard}>
                <View style={[s.txIconCircle, { backgroundColor: isRefund ? '#FEF2F2' : '#ECFDF5' }]}>
                    <Ionicons
                        name={(TYPE_ICONS[item.transaction_type] || 'cash-outline') as any}
                        size={18}
                        color={isRefund ? '#DC2626' : '#059669'}
                    />
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={s.txType}>
                        {item.transaction_type.charAt(0).toUpperCase() + item.transaction_type.slice(1).replace('_', ' ')}
                    </Text>
                    <Text style={s.txDate}>
                        {new Date(item.transaction_date).toLocaleDateString('en-IN', {
                            day: 'numeric', month: 'short', year: 'numeric',
                        })}
                    </Text>
                    {item.description && <Text style={s.txDesc} numberOfLines={1}>{item.description}</Text>}
                </View>
                <Text style={[s.txAmount, isRefund && s.txAmountRefund]}>
                    {isRefund ? '−' : '+'}{formatCurrency(Number(item.amount))}
                </Text>
                <Pressable style={s.txDeleteBtn} onPress={() => handleDelete(item.id)}>
                    <Ionicons name="trash-outline" size={16} color="#DC2626" />
                </Pressable>
            </View>
        );
    }

    return (
        <View style={s.container}>
            <LinearGradient colors={['#ECFDF5', '#F0FDF4', '#FFFFFF']} style={s.gradient}>
                <View style={s.headerWrap}>
                    <View style={s.headerRow}>
                        <View style={{ flex: 1 }}>
                            <Text style={s.kicker}>REVENUE TRACKER</Text>
                            <Text style={s.title}>Revenue</Text>
                        </View>
                        <Pressable style={s.addFab} onPress={() => setShowAddModal(true)}>
                            <Ionicons name="add" size={24} color="#FFFFFF" />
                        </Pressable>
                    </View>

                    {/* Period Selector */}
                    <View style={s.periodRow}>
                        {PERIODS.map(p => (
                            <Pressable
                                key={p.value}
                                style={[s.periodChip, period === p.value && s.periodChipActive]}
                                onPress={() => setPeriod(p.value)}
                            >
                                <Text style={[s.periodText, period === p.value && s.periodTextActive]}>
                                    {p.label}
                                </Text>
                            </Pressable>
                        ))}
                    </View>
                </View>

                {/* Summary Cards */}
                {!loading && !error && (
                    <View style={s.summaryRow}>
                        <View style={[s.summaryCard, { borderLeftColor: '#10B981' }]}>
                            <Text style={s.summaryLabel}>Revenue</Text>
                            <Text style={s.summaryValue}>{formatCurrency(totalRevenue)}</Text>
                        </View>
                        <View style={[s.summaryCard, { borderLeftColor: '#EF4444' }]}>
                            <Text style={s.summaryLabel}>Refunds</Text>
                            <Text style={[s.summaryValue, { color: '#DC2626' }]}>{formatCurrency(totalRefunds)}</Text>
                        </View>
                    </View>
                )}

                {loading && (
                    <View style={s.center}>
                        <ActivityIndicator size="large" color="#10B981" />
                        <Text style={s.centerText}>Loading transactions...</Text>
                    </View>
                )}

                {error && !loading && (
                    <View style={s.center}>
                        <Ionicons name="alert-circle-outline" size={48} color="#DC2626" />
                        <Text style={s.centerText}>{error}</Text>
                    </View>
                )}

                {!loading && !error && transactions.length === 0 && (
                    <View style={s.center}>
                        <View style={s.emptyIcon}>
                            <Ionicons name="receipt-outline" size={48} color="#10B981" />
                        </View>
                        <Text style={s.emptyTitle}>No transactions</Text>
                        <Text style={s.emptySubtitle}>
                            Tap '+' to record your first transaction.
                        </Text>
                    </View>
                )}

                {!loading && !error && transactions.length > 0 && (
                    <FlatList
                        data={transactions}
                        keyExtractor={item => item.id}
                        renderItem={renderTransaction}
                        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 120 }}
                        showsVerticalScrollIndicator={false}
                        refreshControl={
                            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#10B981" colors={['#10B981']} />
                        }
                    />
                )}

                {/* ── Add Transaction Modal ── */}
                <Modal visible={showAddModal} animationType="slide" transparent>
                    <View style={s.modalOverlay}>
                        <View style={s.modalCard}>
                            <View style={s.modalHeader}>
                                <Text style={s.modalTitle}>Add Transaction</Text>
                                <Pressable onPress={() => setShowAddModal(false)}>
                                    <Ionicons name="close" size={24} color="#6B7280" />
                                </Pressable>
                            </View>

                            <View style={s.fieldGroup}>
                                <Text style={s.label}>Amount (₹)</Text>
                                <TextInput
                                    style={s.input}
                                    value={txAmount}
                                    onChangeText={setTxAmount}
                                    placeholder="1500"
                                    placeholderTextColor="#9CA3AF"
                                    keyboardType="numeric"
                                />
                            </View>

                            <View style={s.fieldGroup}>
                                <Text style={s.label}>Type</Text>
                                <View style={s.typeRow}>
                                    {TX_TYPES.map(t => (
                                        <Pressable
                                            key={t.value}
                                            style={[s.typeChip, txType === t.value && s.typeChipActive]}
                                            onPress={() => setTxType(t.value)}
                                        >
                                            <Text style={[s.typeChipText, txType === t.value && s.typeChipTextActive]}>
                                                {t.label}
                                            </Text>
                                        </Pressable>
                                    ))}
                                </View>
                            </View>

                            <View style={s.fieldGroup}>
                                <Text style={s.label}>Description (optional)</Text>
                                <TextInput
                                    style={s.input}
                                    value={txDesc}
                                    onChangeText={setTxDesc}
                                    placeholder="e.g. VIP guest walk-in"
                                    placeholderTextColor="#9CA3AF"
                                />
                            </View>

                            <Pressable
                                style={[s.modalSaveBtn, addLoading && { opacity: 0.6 }]}
                                onPress={handleAddTransaction}
                                disabled={addLoading || !txAmount.trim()}
                            >
                                {addLoading ? (
                                    <ActivityIndicator color="#FFFFFF" />
                                ) : (
                                    <Text style={s.modalSaveBtnText}>Record Transaction</Text>
                                )}
                            </Pressable>
                        </View>
                    </View>
                </Modal>
            </LinearGradient>
        </View>
    );
}

const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F0FDF4' },
    gradient: { flex: 1 },

    headerWrap: { paddingTop: Platform.OS === 'ios' ? 60 : 50, paddingHorizontal: 20, paddingBottom: 12 },
    headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 12 },
    kicker: { color: '#059669', fontSize: 12, letterSpacing: 2, fontFamily: 'SpaceGrotesk_500Medium', marginBottom: 4 },
    title: { color: '#022c22', fontSize: 28, fontFamily: 'SpaceGrotesk_700Bold' },

    addFab: {
        width: 48, height: 48, borderRadius: 16, backgroundColor: '#059669',
        alignItems: 'center', justifyContent: 'center',
        shadowColor: '#059669', shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3, shadowRadius: 8, elevation: 6,
    },

    periodRow: { flexDirection: 'row', gap: 8 },
    periodChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7EB' },
    periodChipActive: { backgroundColor: '#059669', borderColor: '#059669' },
    periodText: { fontSize: 12, fontFamily: 'SpaceGrotesk_500Medium', color: '#6B7280' },
    periodTextActive: { color: '#FFFFFF' },

    summaryRow: { flexDirection: 'row', gap: 12, paddingHorizontal: 20, marginVertical: 16 },
    summaryCard: {
        flex: 1, backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16,
        borderLeftWidth: 4, shadowColor: '#022c22', shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
    },
    summaryLabel: { color: '#6B7280', fontSize: 12, fontFamily: 'SpaceGrotesk_400Regular', marginBottom: 4 },
    summaryValue: { color: '#022c22', fontSize: 22, fontFamily: 'SpaceGrotesk_700Bold' },

    center: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 12 },
    centerText: { color: '#6B7280', fontSize: 14, fontFamily: 'SpaceGrotesk_400Regular' },

    emptyIcon: {
        width: 96, height: 96, borderRadius: 999,
        backgroundColor: 'rgba(16,185,129,0.1)', alignItems: 'center', justifyContent: 'center',
    },
    emptyTitle: { color: '#022c22', fontSize: 20, fontFamily: 'SpaceGrotesk_700Bold' },
    emptySubtitle: { color: '#6B7280', fontSize: 14, fontFamily: 'SpaceGrotesk_400Regular', textAlign: 'center', paddingHorizontal: 40 },

    txCard: {
        flexDirection: 'row', alignItems: 'center', gap: 12,
        backgroundColor: '#FFFFFF', borderRadius: 16, padding: 14, marginBottom: 10,
        shadowColor: '#022c22', shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
    },
    txIconCircle: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    txType: { color: '#022c22', fontSize: 14, fontFamily: 'SpaceGrotesk_500Medium' },
    txDate: { color: '#9CA3AF', fontSize: 11, fontFamily: 'SpaceGrotesk_400Regular', marginTop: 2 },
    txDesc: { color: '#6B7280', fontSize: 11, fontFamily: 'SpaceGrotesk_400Regular', marginTop: 2 },
    txAmount: { color: '#059669', fontSize: 16, fontFamily: 'SpaceGrotesk_700Bold' },
    txAmountRefund: { color: '#DC2626' },
    txDeleteBtn: { padding: 6 },

    // Modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalCard: {
        backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24,
        padding: 24, paddingBottom: Platform.OS === 'ios' ? 40 : 24,
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
    typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    typeChip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#F9FAFB' },
    typeChipActive: { backgroundColor: '#059669', borderColor: '#059669' },
    typeChipText: { fontSize: 13, fontFamily: 'SpaceGrotesk_500Medium', color: '#6B7280' },
    typeChipTextActive: { color: '#FFFFFF' },

    modalSaveBtn: { backgroundColor: '#059669', borderRadius: 16, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
    modalSaveBtnText: { color: '#FFFFFF', fontSize: 16, fontFamily: 'SpaceGrotesk_700Bold' },
});
