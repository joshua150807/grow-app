import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import AppButton from '../../../components/ui/AppButton';
import { COLORS } from '../../../constants/colors';
import { s } from '../../../constants/layout';
import { mentorStyles as styles } from '../styles/mentorStyles';

const POINTS = [
  {
    icon: 'sparkles-outline',
    text: 'Der Grow Mentor ist eine KI. Er coacht dich bei Training, Gewohnheiten, Zielen, Business und persönlicher Entwicklung.',
  },
  {
    icon: 'cloud-outline',
    text: 'Deine Nachrichten werden zur Beantwortung an einen KI-Anbieter übermittelt und in deinem Account gespeichert, damit der Mentor dich besser begleiten kann.',
  },
  {
    icon: 'trash-outline',
    text: 'Du kannst einzelne Chats jederzeit löschen. Wenn du deinen Account löschst, werden alle Mentor-Daten mitgelöscht.',
  },
  {
    icon: 'medkit-outline',
    text: 'Der Mentor ersetzt keine ärztliche, therapeutische, rechtliche oder finanzielle Beratung. Antworten können Fehler enthalten.',
  },
  {
    icon: 'call-outline',
    text: 'In einer akuten Krise wende dich bitte an den Notruf 112 oder die Telefonseelsorge (0800 111 0 111).',
  },
];

export default function MentorConsentView({ onAccept, onOpenPrivacy, submitting, error }) {
  return (
    <ScrollView contentContainerStyle={styles.consentScroll} showsVerticalScrollIndicator={false}>
      <View style={styles.hero}>
        <Text style={styles.heroTitle}>KI MENTOR</Text>
        <Text style={styles.heroSubtitle}>Bevor es losgeht, kurz das Wichtigste.</Text>
      </View>

      <View style={styles.consentCard}>
        {POINTS.map((point) => (
          <View key={point.icon} style={styles.consentPoint}>
            <Ionicons name={point.icon} size={s(18)} color={COLORS.gold} />
            <Text style={styles.consentPointText}>{point.text}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.consentLink} onPress={onOpenPrivacy} accessibilityRole="link">
        Datenschutzerklärung lesen
      </Text>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <AppButton
        title={submitting ? 'Einen Moment…' : 'Verstanden & Mentor starten'}
        onPress={onAccept}
        disabled={submitting}
        haptic="light"
        style={styles.primaryButton}
      />
    </ScrollView>
  );
}
