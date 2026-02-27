import { LinearGradient } from 'expo-linear-gradient';
import { ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function LoungesScreen() {
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
            <Text style={styles.kicker}>LOUNGES</Text>
            <Text style={styles.title}>Find Your Lounge</Text>
            <Text style={styles.subtitle}>Premium airport lounge access worldwide.</Text>
          </View>

          <View style={styles.emptyState}>
            <View style={styles.iconCircle}>
              <Ionicons name="business-outline" size={48} color="#4F46E5" />
            </View>
            <Text style={styles.emptyTitle}>No lounges available yet</Text>
            <Text style={styles.emptySubtitle}>
              Lounge listings will appear here once you have an active booking.
            </Text>
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
    paddingBottom: 40,
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
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    paddingTop: 60,
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 999,
    backgroundColor: 'rgba(79, 70, 229, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    color: '#0B1F33',
    fontSize: 20,
    fontFamily: 'SpaceGrotesk_700Bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    color: '#6B7280',
    fontSize: 15,
    fontFamily: 'SpaceGrotesk_400Regular',
    textAlign: 'center',
    lineHeight: 22,
  },
});
