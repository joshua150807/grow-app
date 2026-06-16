import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';

import PressableScale from '../../../../components/ui/PressableScale';
import { COLORS } from '../../../../constants/colors';
import { s, sv, sf } from '../../../../constants/layout';

export default function GrowCoinInfoScreen() {
  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <PressableScale
          onPress={() => router.back()}
          style={styles.backButton}
          activeScale={0.94}
          activeOpacity={0.8}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Zurück"
        >
          <Feather name="chevron-left" size={s(24)} color={COLORS.toolsText} />
        </PressableScale>

        <Text style={styles.headerTitle}>GROW COIN</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.coinPlaceholder}>
          <Text style={styles.coinSymbol}>G</Text>
        </View>

        <Text style={styles.title}>Deine Grow Points</Text>
        <Text style={styles.intro}>
          Hier entsteht die vollständige Erklärung zur Grow Coin und zum Grow-Points-System.
        </Text>

        <View style={styles.infoCard}>
          <Text style={styles.cardTitle}>Was sind Grow Points?</Text>
          <Text style={styles.cardText}>
            Platzhaltertext: Grow Points belohnen dich für deine Aktivität und deinen Fortschritt innerhalb von Grow.
          </Text>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.cardTitle}>Wie sammle ich sie?</Text>
          <Text style={styles.cardText}>
            Platzhaltertext: Hier werden später alle Möglichkeiten erklärt, mit denen du Grow Points verdienen kannst.
          </Text>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.cardTitle}>Wofür kann ich sie nutzen?</Text>
          <Text style={styles.cardText}>
            Platzhaltertext: An dieser Stelle folgen später Belohnungen, Vorteile und weitere Funktionen der Grow Coin.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.toolsBg ?? COLORS.black,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: sv(56),
    paddingHorizontal: s(18),
    paddingBottom: sv(14),
  },
  backButton: {
    width: s(42),
    height: s(42),
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: s(21),
    backgroundColor: COLORS.toolsCard,
    borderWidth: 1,
    borderColor: COLORS.toolsCardBorder,
  },
  headerTitle: {
    color: COLORS.toolsText,
    fontSize: sf(13),
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  headerSpacer: {
    width: s(42),
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: s(20),
    paddingTop: sv(20),
    paddingBottom: sv(50),
  },
  coinPlaceholder: {
    width: s(104),
    height: s(104),
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: s(52),
    backgroundColor: COLORS.toolsCardSoft,
    borderWidth: 1,
    borderColor: COLORS.toolsCardBorderActive,
    marginBottom: sv(24),
  },
  coinSymbol: {
    color: COLORS.toolsGold,
    fontSize: sf(44),
    fontWeight: '800',
  },
  title: {
    color: COLORS.toolsText,
    fontSize: sf(25),
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: sv(10),
  },
  intro: {
    color: COLORS.toolsTextMuted,
    fontSize: sf(14),
    lineHeight: sf(21),
    textAlign: 'center',
    marginBottom: sv(26),
    maxWidth: s(330),
  },
  infoCard: {
    width: '100%',
    paddingHorizontal: s(18),
    paddingVertical: sv(18),
    marginBottom: sv(14),
    borderRadius: s(16),
    backgroundColor: COLORS.toolsCard,
    borderWidth: 1,
    borderColor: COLORS.toolsCardBorder,
  },
  cardTitle: {
    color: COLORS.toolsGold,
    fontSize: sf(15),
    fontWeight: '700',
    marginBottom: sv(8),
  },
  cardText: {
    color: COLORS.toolsTextMuted,
    fontSize: sf(13.5),
    lineHeight: sf(20),
  },
});
