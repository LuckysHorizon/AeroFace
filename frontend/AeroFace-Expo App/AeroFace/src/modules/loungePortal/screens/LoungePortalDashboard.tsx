import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';

import LoungeOverviewScreen from './LoungeOverviewScreen';
import LoungeMembersScreen from './LoungeMembersScreen';
import LoungeRevenueScreen from './LoungeRevenueScreen';
import LoungePlansScreen from './LoungePlansScreen';
import LoungeSettingsScreen from './LoungeSettingsScreen';

type PortalTab = 'Overview' | 'Members' | 'Revenue' | 'Plans' | 'Settings';

const TABS: { key: PortalTab; icon: keyof typeof Ionicons.glyphMap; label: string }[] = [
    { key: 'Overview', icon: 'grid-outline', label: 'Overview' },
    { key: 'Members', icon: 'people-outline', label: 'Members' },
    { key: 'Revenue', icon: 'trending-up-outline', label: 'Revenue' },
    { key: 'Plans', icon: 'pricetags-outline', label: 'Plans' },
    { key: 'Settings', icon: 'settings-outline', label: 'Settings' },
];

export default function LoungePortalDashboard() {
    const [activeTab, setActiveTab] = useState<PortalTab>('Overview');

    return (
        <View style={s.container}>
            {/* All screens stay mounted — inactive hidden via display:'none' */}
            <View style={[s.screenLayer, activeTab !== 'Overview' && s.hidden]}>
                <LoungeOverviewScreen />
            </View>
            <View style={[s.screenLayer, activeTab !== 'Members' && s.hidden]}>
                <LoungeMembersScreen />
            </View>
            <View style={[s.screenLayer, activeTab !== 'Revenue' && s.hidden]}>
                <LoungeRevenueScreen />
            </View>
            <View style={[s.screenLayer, activeTab !== 'Plans' && s.hidden]}>
                <LoungePlansScreen />
            </View>
            <View style={[s.screenLayer, activeTab !== 'Settings' && s.hidden]}>
                <LoungeSettingsScreen />
            </View>

            {/* Floating Bottom Navigation */}
            <View style={s.navBarContainer}>
                <BlurView intensity={80} tint="light" style={s.navBar}>
                    {TABS.map(tab => (
                        <Pressable
                            key={tab.key}
                            style={[s.navItem, activeTab === tab.key && s.navItemActive]}
                            onPress={() => setActiveTab(tab.key)}
                        >
                            <Ionicons
                                name={tab.icon}
                                size={20}
                                color={activeTab === tab.key ? '#059669' : '#6B7280'}
                            />
                            <Text style={[s.navLabel, activeTab === tab.key && s.navLabelActive]}>
                                {tab.label}
                            </Text>
                        </Pressable>
                    ))}
                </BlurView>
            </View>
        </View>
    );
}

const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F0FDF4' },
    screenLayer: { flex: 1 },
    hidden: { display: 'none' },

    navBarContainer: { position: 'absolute', bottom: 20, left: 16, right: 16 },
    navBar: {
        flexDirection: 'row',
        backgroundColor: 'rgba(255,255,255,0.6)',
        borderRadius: 40,
        paddingVertical: 8,
        paddingHorizontal: 4,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.8)',
        shadowColor: '#022c22',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.12,
        shadowRadius: 24,
        elevation: 12,
    },
    navItem: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 5,
        borderRadius: 32,
    },
    navItemActive: { backgroundColor: '#fff' },
    navLabel: {
        color: '#6B7280',
        fontSize: 9,
        marginTop: 2,
        fontFamily: 'SpaceGrotesk_500Medium',
    },
    navLabelActive: {
        color: '#059669',
        fontFamily: 'SpaceGrotesk_700Bold',
    },
});
