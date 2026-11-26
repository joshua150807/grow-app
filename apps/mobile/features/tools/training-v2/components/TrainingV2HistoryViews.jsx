import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { COLORS } from '../../../../constants/colors';
import { s } from '../../../../constants/layout';
import { styles } from '../styles/trainingV2Styles';

const dateFormat = new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium' });
export const historyNumber = new Intl.NumberFormat('de-DE');

export function formatTrainingDate(session) {
  return dateFormat.format(new Date(session.endedAt ?? session.createdAt));
}

export function formatTrainingDuration(seconds) {
  const wholeSeconds = Math.round(seconds);
  const minutes = Math.floor(wholeSeconds / 60);
  const rest = wholeSeconds % 60;
  if (minutes === 0) return `${rest} Sek.`;
  return rest === 0 ? `${minutes} Min.` : `${minutes} Min. ${rest} Sek.`;
}

export function TrainingHistoryHeader({ title }) {
  return (
    <View style={styles.topRow}>
      <Pressable accessibilityRole="button" accessibilityLabel="Zurück" style={styles.backButton} onPress={() => router.back()}>
        <Ionicons name="chevron-back" size={s(22)} color={COLORS.softGold} />
      </Pressable>
      <Text accessibilityRole="header" style={styles.title}>{title}</Text>
    </View>
  );
}

export function TrainingHistoryCard({ session }) {
  return (
    <Pressable
      accessibilityRole="button"
      style={[styles.planCard, styles.cardRow]}
      onPress={() => router.push({ pathname: '/tools/training-v2-session-detail', params: { sessionId: session.id } })}
    >
      <Ionicons name="barbell-outline" size={s(22)} color={COLORS.softGold} />
      <View style={styles.cardBody}>
        <Text style={styles.mtPlanCardName}>{session.unitName}</Text>
        <Text style={styles.mtPlanCardMeta}>{session.planName} · {formatTrainingDate(session)}</Text>
        <Text style={styles.mtPlanCardMeta}>
          {session.exerciseCount} {session.exerciseCount === 1 ? 'Übung' : 'Übungen'}
          {session.status === 'incomplete' ? ' · Nicht abgeschlossen' : ''}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={s(16)} color={COLORS.softGold} />
    </Pressable>
  );
}
