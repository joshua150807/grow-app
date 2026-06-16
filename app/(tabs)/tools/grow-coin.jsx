import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';

import { COLORS } from '../../../constants/colors';
import { s, sv, sf } from '../../../constants/layout';
import { GROW_COIN } from '../../../constants/toolAssets';

export default function GrowCoinInfoScreen() {
  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Pressable
          onPress={() => router.back()}
          style={styles.backButton}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Zurück"
        >
          <Feather name="chevron-left" size={s(24)} color={COLORS.toolsText} />
          <Text style={styles.backText}>Zurück</Text>
        </Pressable>

        <View style={styles.heroCard}>
          <Image source={GROW_COIN} style={styles.coinImage} resizeMode="contain" />

          <Text style={styles.kicker}>GROW COIN</Text>
          <Text style={styles.title}>Was ist der Grow Coin?</Text>

          <Text style={styles.description}>
            Der Grow Coin ist aktuell dein Platzhalter für Fortschritt, Aktivität und
            Belohnungen in Grow. Später wird hier genauer erklärt, wofür du Coins
            erhältst, wie du sie sammeln kannst und welche Rolle sie für Tools,
            Challenges und Motivation spielen.
          </Text>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.cardTitle}>Wofür steht er?</Text>
          <Text style={styles.cardText}>
            Dieser Text ist erstmal ein Platzhalter. Der Grow Coin soll langfristig
            sichtbar machen, dass du aktiv an dir arbeitest und in Grow Fortschritt
            aufbaust.
          </Text>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.cardTitle}>Was kommt später?</Text>
          <Text style={styles.cardText}>
            Später können hier Regeln, Belohnungen, Challenges und weitere Details
            zum Coin-System ergänzt werden.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.toolsBg ?? '#050403',
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: s(20),
    paddingTop: sv(10),
    paddingBottom: sv(34),
  },
  backButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: sv(18),
    paddingVertical: sv(6),
    paddingRight: s(12),
  },
  backText: {
    color: COLORS.toolsText,
    fontSize: sf(14),
    fontWeight: '600',
    marginLeft: s(2),
  },
  heroCard: {
    alignItems: 'center',
    borderRadius: s(24),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(231,201,138,0.28)',
    backgroundColor: 'rgba(255,255,255,0.045)',
    paddingHorizontal: s(22),
    paddingTop: sv(28),
    paddingBottom: sv(26),
    marginBottom: sv(16),
  },
  coinImage: {
    width: s(88),
    height: s(88),
    marginBottom: sv(14),
  },
  kicker: {
    color: COLORS.toolsGold,
    fontSize: sf(11),
    fontWeight: '800',
    letterSpacing: 2.2,
    marginBottom: sv(8),
  },
  title: {
    color: COLORS.toolsText,
    fontSize: sf(24),
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: sv(12),
  },
  description: {
    color: 'rgba(255,241,210,0.68)',
    fontSize: sf(14),
    lineHeight: sf(21),
    textAlign: 'center',
  },
  infoCard: {
    borderRadius: s(18),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: COLORS.toolsCard,
    paddingHorizontal: s(18),
    paddingVertical: sv(16),
    marginBottom: sv(12),
  },
  cardTitle: {
    color: COLORS.toolsText,
    fontSize: sf(15),
    fontWeight: '800',
    marginBottom: sv(7),
  },
  cardText: {
    color: 'rgba(255,241,210,0.58)',
    fontSize: sf(13),
    lineHeight: sf(19),
  },
});
