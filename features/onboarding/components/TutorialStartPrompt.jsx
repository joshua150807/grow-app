import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { COLORS } from '../../../constants/colors';
import { s, sv, sf } from '../../../constants/layout';

export default function TutorialStartPrompt({ visible, onDecline, onStart }) {
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.iconCircle}>
            <Feather name="compass" size={s(25)} color={COLORS.nearBlack} />
          </View>

          <Text style={styles.eyebrow}>ERSTER START</Text>
          <Text style={styles.title}>Willst du ein kurzes Tutorial machen?</Text>
          <Text style={styles.text}>
            Ich zeige dir in wenigen Schritten Feed, Tools, Grow Points und Feedback.
            Du kannst das Tutorial später jederzeit über die drei Punkte in der Tools-Übersicht starten.
          </Text>

          <View style={styles.buttonRow}>
            <Pressable style={[styles.button, styles.secondaryButton]} onPress={onDecline}>
              <Text style={styles.secondaryButtonText}>Nein</Text>
            </Pressable>

            <Pressable style={[styles.button, styles.primaryButton]} onPress={onStart}>
              <Text style={styles.primaryButtonText}>Tutorial starten</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: s(22),
  },
  card: {
    width: '100%',
    maxWidth: s(360),
    borderRadius: s(24),
    borderWidth: 1,
    borderColor: 'rgba(231,201,138,0.28)',
    backgroundColor: '#0B080E',
    paddingHorizontal: s(22),
    paddingTop: sv(24),
    paddingBottom: sv(20),
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.38,
    shadowRadius: 26,
    elevation: 18,
  },
  iconCircle: {
    width: s(52),
    height: s(52),
    borderRadius: s(26),
    backgroundColor: COLORS.toolsGold,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: sv(16),
    shadowColor: COLORS.toolsGold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius: 16,
    elevation: 8,
  },
  eyebrow: {
    color: 'rgba(231,201,138,0.72)',
    fontSize: sf(10),
    fontWeight: '700',
    letterSpacing: 2.2,
    textAlign: 'center',
    marginBottom: sv(8),
  },
  title: {
    color: COLORS.toolsText,
    fontSize: sf(22),
    fontWeight: '700',
    lineHeight: sf(28),
    textAlign: 'center',
    marginBottom: sv(10),
  },
  text: {
    color: 'rgba(255,241,210,0.68)',
    fontSize: sf(14),
    lineHeight: sf(20),
    textAlign: 'center',
    marginBottom: sv(22),
  },
  buttonRow: {
    flexDirection: 'row',
    gap: s(10),
  },
  button: {
    flex: 1,
    minHeight: sv(46),
    borderRadius: s(14),
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: s(12),
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: 'rgba(255,241,210,0.14)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  primaryButton: {
    backgroundColor: COLORS.toolsGold,
  },
  secondaryButtonText: {
    color: COLORS.toolsText,
    fontSize: sf(14),
    fontWeight: '700',
  },
  primaryButtonText: {
    color: COLORS.nearBlack,
    fontSize: sf(14),
    fontWeight: '800',
  },
});
