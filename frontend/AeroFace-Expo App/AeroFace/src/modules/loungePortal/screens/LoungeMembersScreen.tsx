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
    getMembers,
    addMember,
    updateMemberStatus,
    deleteMember,
    Membership,
} from '../lib/loungeApi';

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
    active: { bg: '#DCFCE7', text: '#15803D' },
    pending: { bg: '#FEF3C7', text: '#92400E' },
    expired: { bg: '#FEE2E2', text: '#991B1B' },
    revoked: { bg: '#F3F4F6', text: '#6B7280' },
};

const TYPE_LABELS: Record<string, string> = {
    standard: 'Standard',
    premium: 'Premium',
    vip: 'VIP',
};

const MEMBERSHIP_TYPES: ('standard' | 'premium' | 'vip')[] = ['standard', 'premium', 'vip'];

export default function LoungeMembersScreen() {
    const [members, setMembers] = useState<Membership[]>([]);
    const [loungeId, setLoungeId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Add Member Modal
    const [showAddModal, setShowAddModal] = useState(false);
    const [newName, setNewName] = useState('');
    const [newEmail, setNewEmail] = useState('');
    const [newType, setNewType] = useState<'standard' | 'premium' | 'vip'>('standard');
    const [addLoading, setAddLoading] = useState(false);

    useEffect(() => { loadData(); }, []);

    async function loadData() {
        try {
            setError(null);
            if (!refreshing) setLoading(true);
            const lounge = await getOwnerLounge();
            if (!lounge) { setError('No lounge registered.'); return; }
            setLoungeId(lounge.id);
            const data = await getMembers(lounge.id);
            setMembers(data);
        } catch (e: any) {
            setError(e.message || 'Failed to load members');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }

    const onRefresh = useCallback(() => { setRefreshing(true); loadData(); }, []);

    const handleStatusChange = async (membershipId: string, status: 'active' | 'revoked') => {
        try {
            setActionLoading(membershipId);
            await updateMemberStatus(membershipId, status);
            setMembers(prev =>
                prev.map(m => m.id === membershipId ? { ...m, status } : m)
            );
        } catch (e: any) {
            console.error('[Members] Action failed:', e);
        } finally {
            setActionLoading(null);
        }
    };

    const handleDelete = (membershipId: string, name: string) => {
        Alert.alert(
            'Remove Member',
            `Are you sure you want to remove ${name}?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Remove',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            setActionLoading(membershipId);
                            await deleteMember(membershipId);
                            setMembers(prev => prev.filter(m => m.id !== membershipId));
                        } catch (e: any) {
                            console.error('[Members] Delete failed:', e);
                        } finally {
                            setActionLoading(null);
                        }
                    },
                },
            ]
        );
    };

    const handleAddMember = async () => {
        if (!loungeId || !newName.trim() || !newEmail.trim()) return;
        try {
            setAddLoading(true);
            const newMember = await addMember({
                lounge_id: loungeId,
                user_name: newName.trim(),
                user_email: newEmail.trim(),
                membership_type: newType,
                status: 'active',
            });
            setMembers(prev => [newMember, ...prev]);
            setNewName('');
            setNewEmail('');
            setNewType('standard');
            setShowAddModal(false);
        } catch (e: any) {
            Alert.alert('Error', e.message || 'Failed to add member');
        } finally {
            setAddLoading(false);
        }
    };

    function renderMember({ item }: { item: Membership }) {
        const statusStyle = STATUS_COLORS[item.status] || STATUS_COLORS.pending;
        const isActioning = actionLoading === item.id;

        return (
            <View style={s.memberCard}>
                <View style={s.memberHeader}>
                    <View style={s.avatarCircle}>
                        <Text style={s.avatarText}>
                            {(item.user_name || item.user_email || '?')[0].toUpperCase()}
                        </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={s.memberName} numberOfLines={1}>
                            {item.user_name || 'Unknown User'}
                        </Text>
                        <Text style={s.memberEmail} numberOfLines={1}>
                            {item.user_email || 'No email'}
                        </Text>
                    </View>
                    <View style={[s.statusBadge, { backgroundColor: statusStyle.bg }]}>
                        <Text style={[s.statusText, { color: statusStyle.text }]}>
                            {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                        </Text>
                    </View>
                </View>

                <View style={s.memberMeta}>
                    <View style={s.metaChip}>
                        <Ionicons name="card-outline" size={13} color="#6B7280" />
                        <Text style={s.metaText}>{TYPE_LABELS[item.membership_type] || item.membership_type}</Text>
                    </View>
                    <View style={s.metaChip}>
                        <Ionicons name="calendar-outline" size={13} color="#6B7280" />
                        <Text style={s.metaText}>
                            Since {new Date(item.start_date).toLocaleDateString()}
                        </Text>
                    </View>
                </View>

                {/* Action Buttons */}
                <View style={s.actionRow}>
                    {item.status === 'pending' && (
                        <Pressable
                            style={[s.actionBtn, s.approveBtn]}
                            onPress={() => handleStatusChange(item.id, 'active')}
                            disabled={isActioning}
                        >
                            {isActioning ? <ActivityIndicator size="small" color="#15803D" /> : (
                                <>
                                    <Ionicons name="checkmark-circle-outline" size={16} color="#15803D" />
                                    <Text style={[s.actionBtnText, { color: '#15803D' }]}>Approve</Text>
                                </>
                            )}
                        </Pressable>
                    )}
                    {(item.status === 'active' || item.status === 'pending') && (
                        <Pressable
                            style={[s.actionBtn, s.revokeBtn]}
                            onPress={() => handleStatusChange(item.id, 'revoked')}
                            disabled={isActioning}
                        >
                            {isActioning ? <ActivityIndicator size="small" color="#DC2626" /> : (
                                <>
                                    <Ionicons name="close-circle-outline" size={16} color="#DC2626" />
                                    <Text style={[s.actionBtnText, { color: '#DC2626' }]}>Revoke</Text>
                                </>
                            )}
                        </Pressable>
                    )}
                    {item.status === 'revoked' && (
                        <Pressable
                            style={[s.actionBtn, s.approveBtn]}
                            onPress={() => handleStatusChange(item.id, 'active')}
                            disabled={isActioning}
                        >
                            {isActioning ? <ActivityIndicator size="small" color="#15803D" /> : (
                                <>
                                    <Ionicons name="refresh-outline" size={16} color="#15803D" />
                                    <Text style={[s.actionBtnText, { color: '#15803D' }]}>Reinstate</Text>
                                </>
                            )}
                        </Pressable>
                    )}
                    {/* Delete Button */}
                    <Pressable
                        style={[s.actionBtn, s.deleteBtn]}
                        onPress={() => handleDelete(item.id, item.user_name || 'this member')}
                        disabled={isActioning}
                    >
                        <Ionicons name="trash-outline" size={16} color="#991B1B" />
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
                            <Text style={s.kicker}>MEMBERSHIP MANAGEMENT</Text>
                            <Text style={s.title}>Members</Text>
                            <Text style={s.subtitle}>
                                {members.length > 0
                                    ? `${members.length} member${members.length !== 1 ? 's' : ''} registered`
                                    : 'Manage your lounge memberships'}
                            </Text>
                        </View>
                        <Pressable style={s.addFab} onPress={() => setShowAddModal(true)}>
                            <Ionicons name="add" size={24} color="#FFFFFF" />
                        </Pressable>
                    </View>
                </View>

                {loading && (
                    <View style={s.center}>
                        <ActivityIndicator size="large" color="#10B981" />
                        <Text style={s.centerText}>Loading members...</Text>
                    </View>
                )}

                {error && !loading && (
                    <View style={s.center}>
                        <Ionicons name="alert-circle-outline" size={48} color="#DC2626" />
                        <Text style={s.centerText}>{error}</Text>
                    </View>
                )}

                {!loading && !error && members.length === 0 && (
                    <View style={s.center}>
                        <View style={s.emptyIcon}>
                            <Ionicons name="people-outline" size={48} color="#10B981" />
                        </View>
                        <Text style={s.emptyTitle}>No members yet</Text>
                        <Text style={s.emptySubtitle}>
                            Tap '+' to add your first member.
                        </Text>
                    </View>
                )}

                {!loading && !error && members.length > 0 && (
                    <FlatList
                        data={members}
                        keyExtractor={item => item.id}
                        renderItem={renderMember}
                        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 120 }}
                        showsVerticalScrollIndicator={false}
                        refreshControl={
                            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#10B981" colors={['#10B981']} />
                        }
                    />
                )}

                {/* ── Add Member Modal ── */}
                <Modal visible={showAddModal} animationType="slide" transparent>
                    <View style={s.modalOverlay}>
                        <View style={s.modalCard}>
                            <View style={s.modalHeader}>
                                <Text style={s.modalTitle}>Add Member</Text>
                                <Pressable onPress={() => setShowAddModal(false)}>
                                    <Ionicons name="close" size={24} color="#6B7280" />
                                </Pressable>
                            </View>

                            <View style={s.fieldGroup}>
                                <Text style={s.label}>Full Name</Text>
                                <TextInput
                                    style={s.input}
                                    value={newName}
                                    onChangeText={setNewName}
                                    placeholder="John Doe"
                                    placeholderTextColor="#9CA3AF"
                                />
                            </View>

                            <View style={s.fieldGroup}>
                                <Text style={s.label}>Email</Text>
                                <TextInput
                                    style={s.input}
                                    value={newEmail}
                                    onChangeText={setNewEmail}
                                    placeholder="john@example.com"
                                    placeholderTextColor="#9CA3AF"
                                    keyboardType="email-address"
                                    autoCapitalize="none"
                                />
                            </View>

                            <View style={s.fieldGroup}>
                                <Text style={s.label}>Membership Type</Text>
                                <View style={s.typeRow}>
                                    {MEMBERSHIP_TYPES.map(t => (
                                        <Pressable
                                            key={t}
                                            style={[s.typeChip, newType === t && s.typeChipActive]}
                                            onPress={() => setNewType(t)}
                                        >
                                            <Text style={[s.typeChipText, newType === t && s.typeChipTextActive]}>
                                                {TYPE_LABELS[t]}
                                            </Text>
                                        </Pressable>
                                    ))}
                                </View>
                            </View>

                            <Pressable
                                style={[s.modalSaveBtn, addLoading && { opacity: 0.6 }]}
                                onPress={handleAddMember}
                                disabled={addLoading || !newName.trim() || !newEmail.trim()}
                            >
                                {addLoading ? (
                                    <ActivityIndicator color="#FFFFFF" />
                                ) : (
                                    <Text style={s.modalSaveBtnText}>Add Member</Text>
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

    memberCard: {
        backgroundColor: '#FFFFFF', borderRadius: 20, padding: 16, marginBottom: 12,
        shadowColor: '#022c22', shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
    },
    memberHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
    avatarCircle: {
        width: 44, height: 44, borderRadius: 22,
        backgroundColor: '#ECFDF5', alignItems: 'center', justifyContent: 'center',
    },
    avatarText: { color: '#059669', fontSize: 18, fontFamily: 'SpaceGrotesk_700Bold' },
    memberName: { color: '#022c22', fontSize: 16, fontFamily: 'SpaceGrotesk_700Bold' },
    memberEmail: { color: '#6B7280', fontSize: 12, fontFamily: 'SpaceGrotesk_400Regular', marginTop: 2 },

    statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
    statusText: { fontSize: 11, fontFamily: 'SpaceGrotesk_500Medium' },

    memberMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
    metaChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#F3F4F6', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
    metaText: { color: '#6B7280', fontSize: 11, fontFamily: 'SpaceGrotesk_400Regular' },

    actionRow: { flexDirection: 'row', gap: 8 },
    actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, borderWidth: 1 },
    approveBtn: { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' },
    revokeBtn: { backgroundColor: '#FEF2F2', borderColor: '#FECACA' },
    deleteBtn: { backgroundColor: '#FEF2F2', borderColor: '#FECACA', paddingHorizontal: 10 },
    actionBtnText: { fontSize: 12, fontFamily: 'SpaceGrotesk_500Medium' },

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
    typeRow: { flexDirection: 'row', gap: 8 },
    typeChip: { flex: 1, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', alignItems: 'center', backgroundColor: '#F9FAFB' },
    typeChipActive: { backgroundColor: '#059669', borderColor: '#059669' },
    typeChipText: { fontSize: 13, fontFamily: 'SpaceGrotesk_500Medium', color: '#6B7280' },
    typeChipTextActive: { color: '#FFFFFF' },

    modalSaveBtn: { backgroundColor: '#059669', borderRadius: 16, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
    modalSaveBtnText: { color: '#FFFFFF', fontSize: 16, fontFamily: 'SpaceGrotesk_700Bold' },
});
