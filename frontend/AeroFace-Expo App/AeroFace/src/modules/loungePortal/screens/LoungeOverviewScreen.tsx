import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Platform,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { getOwnerLounge, getLoungeStats, LoungeStats } from '../lib/loungeApi';

export default function LoungeOverviewScreen() {
    const [stats, setStats] = useState<LoungeStats | null>(null);
    const [loungeName, setLoungeName] = useState('');
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => { loadData(); }, []);

    async function loadData() {
        try {
            setError(null);
            if (!refreshing) setLoading(true);
            const lounge = await getOwnerLounge();
            if (!lounge) {
                setError('No lounge registered yet.');
                return;
            }
            setLoungeName(lounge.name);
            const s = await getLoungeStats(lounge.id);
            setStats(s);
        } catch (e: any) {
            setError(e.message || 'Failed to load data');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }

    const onRefresh = () => { setRefreshing(true); loadData(); };

    const formatCurrency = (val: number) =>
        '₹' + val.toLocaleString('en-IN', { maximumFractionDigits: 0 });

    const kpis = stats
        ? [
            { label: "Today's Revenue", value: formatCurrency(stats.today_revenue), icon: 'cash-outline' as const, color: '#10B981' },
            { label: 'This Month', value: formatCurrency(stats.month_revenue), icon: 'trending-up-outline' as const, color: '#3B82F6' },
            { label: 'Active Members', value: String(stats.active_members), icon: 'people-outline' as const, color: '#8B5CF6' },
            { label: 'Pending Approvals', value: String(stats.pending_members), icon: 'hourglass-outline' as const, color: '#F59E0B' },
        ]
        : [];

    return (
        <View style={s.container}>
            <LinearGradient colors={['#ECFDF5', '#F0FDF4', '#FFFFFF']} style={s.gradient}>
                <ScrollView
                    contentContainerStyle={s.scrollContent}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#10B981" colors={['#10B981']} />
                    }
                >
                    <View style={s.header}>
                        <Text style={s.kicker}>LOUNGE OVERVIEW</Text>
                        <Text style={s.title}>{loungeName || 'Your Lounge'}</Text>
                        <Text style={s.subtitle}>Real-time business metrics</Text>
                    </View>

                    {loading && (
                        <View style={s.center}>
                            <ActivityIndicator size="large" color="#10B981" />
                            <Text style={s.centerText}>Loading dashboard...</Text>
                        </View>
                    )}

                    {error && !loading && (
                        <View style={s.center}>
                            <Ionicons name="alert-circle-outline" size={48} color="#DC2626" />
                            <Text style={s.centerText}>{error}</Text>
                        </View>
                    )}

                    {!loading && !error && stats && (
                        <>
                            {/* KPI Grid */}
                            <View style={s.kpiGrid}>
                                {kpis.map((kpi, i) => (
                                    <View key={i} style={s.kpiCard}>
                                        <View style={[s.kpiIconCircle, { backgroundColor: kpi.color + '15' }]}>
                                            <Ionicons name={kpi.icon} size={22} color={kpi.color} />
                                        </View>
                                        <Text style={s.kpiValue}>{kpi.value}</Text>
                                        <Text style={s.kpiLabel}>{kpi.label}</Text>
                                    </View>
                                ))}
                            </View>

                            {/* Summary Card */}
                            <View style={s.summaryCard}>
                                <Text style={s.summaryTitle}>Lifetime Summary</Text>
                                <View style={s.summaryRow}>
                                    <Text style={s.summaryLabel}>Total Revenue</Text>
                                    <Text style={s.summaryValue}>{formatCurrency(stats.total_revenue)}</Text>
                                </View>
                                <View style={s.divider} />
                                <View style={s.summaryRow}>
                                    <Text style={s.summaryLabel}>Total Members</Text>
                                    <Text style={s.summaryValue}>{stats.total_members}</Text>
                                </View>
                                <View style={s.divider} />
                                <View style={s.summaryRow}>
                                    <Text style={s.summaryLabel}>Transactions</Text>
                                    <Text style={s.summaryValue}>{stats.total_transactions}</Text>
                                </View>
                            </View>
                        </>
                    )}

                    <View style={{ height: 120 }} />
                </ScrollView>
            </LinearGradient>
        </View>
    );
}

const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F0FDF4' },
    gradient: { flex: 1 },
    scrollContent: { paddingTop: Platform.OS === 'ios' ? 60 : 50, paddingHorizontal: 20 },

    header: { marginBottom: 24 },
    kicker: { color: '#059669', fontSize: 12, letterSpacing: 2, fontFamily: 'SpaceGrotesk_500Medium', marginBottom: 4 },
    title: { color: '#022c22', fontSize: 28, fontFamily: 'SpaceGrotesk_700Bold' },
    subtitle: { color: '#6B7280', fontSize: 14, fontFamily: 'SpaceGrotesk_400Regular', marginTop: 4 },

    center: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 12 },
    centerText: { color: '#6B7280', fontSize: 14, fontFamily: 'SpaceGrotesk_400Regular' },

    kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 20 },
    kpiCard: {
        width: '47%', backgroundColor: '#FFFFFF', borderRadius: 20, padding: 18,
        shadowColor: '#022c22', shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06, shadowRadius: 10, elevation: 3,
    },
    kpiIconCircle: {
        width: 44, height: 44, borderRadius: 14, alignItems: 'center',
        justifyContent: 'center', marginBottom: 12,
    },
    kpiValue: { color: '#022c22', fontSize: 24, fontFamily: 'SpaceGrotesk_700Bold', marginBottom: 4 },
    kpiLabel: { color: '#6B7280', fontSize: 12, fontFamily: 'SpaceGrotesk_400Regular' },

    summaryCard: {
        backgroundColor: '#FFFFFF', borderRadius: 20, padding: 20,
        shadowColor: '#022c22', shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06, shadowRadius: 10, elevation: 3,
    },
    summaryTitle: { color: '#022c22', fontSize: 18, fontFamily: 'SpaceGrotesk_700Bold', marginBottom: 16 },
    summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12 },
    summaryLabel: { color: '#6B7280', fontSize: 14, fontFamily: 'SpaceGrotesk_400Regular' },
    summaryValue: { color: '#022c22', fontSize: 16, fontFamily: 'SpaceGrotesk_700Bold' },
    divider: { height: 1, backgroundColor: '#E5E7EB' },
});
