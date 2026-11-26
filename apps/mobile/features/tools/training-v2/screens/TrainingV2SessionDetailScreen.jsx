import { getEffectiveTrainingSessionDurationSeconds } from '@grow/shared';
import { useLocalSearchParams } from 'expo-router';
import { RefreshControl, ScrollView, Text, View } from 'react-native';

import { COLORS } from '../../../../constants/colors';
import {
  formatTrainingDate, formatTrainingDuration, historyNumber, TrainingHistoryHeader,
} from '../components/TrainingV2HistoryViews';
import { TrainingV2StateView } from '../components/TrainingV2StateView';
import { useTrainingV2HistoryDetail } from '../hooks/useTrainingV2History';
import { styles } from '../styles/trainingV2Styles';

const setTypes = { warmup: 'Aufwärmsatz', work: 'Arbeitssatz', drop: 'Dropsatz' };

function HistorySet({ set }) {
  return (
    <View style={styles.section}>
      <Text style={styles.mtPlanCardMeta}>Satz {set.orderIndex + 1} · {setTypes[set.setType]}</Text>
      {set.weightKg !== null ? <Text style={styles.meta}>Last: {historyNumber.format(set.weightKg)} kg</Text> : null}
      {set.reps !== null ? <Text style={styles.meta}>Wiederholungen: {historyNumber.format(set.reps)}</Text> : null}
      {set.note ? <Text style={styles.meta}>Satznotiz: {set.note}</Text> : null}
    </View>
  );
}

export default function TrainingV2SessionDetailScreen() {
  const { sessionId } = useLocalSearchParams();
  const detail = useTrainingV2HistoryDetail(typeof sessionId === 'string' ? sessionId : null);
  const session = detail.data;
  const duration = session ? getEffectiveTrainingSessionDurationSeconds(session) : null;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={detail.refreshing} onRefresh={detail.refresh} tintColor={COLORS.softGold} />}
    >
      <TrainingHistoryHeader title="Trainingsdetails" />
      <TrainingV2StateView loading={detail.loading} error={detail.error} onRetry={detail.retry} />
      {session ? (
        <>
          <View style={styles.detailHeader}>
            <Text accessibilityRole="header" style={styles.detailName}>{session.unitName}</Text>
            <Text style={styles.mtPlanCardMeta}>{session.planName} · {formatTrainingDate(session)}</Text>
            {duration !== null ? <Text style={styles.mtPlanCardMeta}>{formatTrainingDuration(duration)}</Text> : null}
            {session.status === 'incomplete' ? <Text style={styles.mtPlanCardMeta}>Nicht abgeschlossen</Text> : null}
          </View>
          {session.exercises.length === 0 ? <Text style={styles.emptyText}>Keine Übungen protokolliert.</Text> : null}
          {session.exercises.map((exercise) => (
            <View key={exercise.id} style={styles.planCard}>
              <Text accessibilityRole="header" style={styles.mtPlanCardName}>{exercise.exerciseName}</Text>
              {exercise.note ? <Text style={styles.meta}>Übungsnotiz: {exercise.note}</Text> : null}
              {exercise.sets.map((set) => <HistorySet key={set.id} set={set} />)}
            </View>
          ))}
        </>
      ) : null}
    </ScrollView>
  );
}
