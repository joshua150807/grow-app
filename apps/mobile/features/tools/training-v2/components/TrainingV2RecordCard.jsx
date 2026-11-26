import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { COLORS } from '../../../../constants/colors';
import { s } from '../../../../constants/layout';
import { styles } from '../styles/trainingV2Styles';

const number = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 });
const shortDate = value => new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' }).format(new Date(value));
const loadSuffix = { per_hand: ' pro Hand', per_side: ' pro Seite' };

// Weight as the user logged it for this exercise's load type (added weight shows as "+x kg").
export function recordWeightText(weightKg, loadType) {
  if (weightKg === null || weightKg === undefined) return 'Körpergewicht';
  return `${loadType === 'added_weight_only' ? '+' : ''}${number.format(weightKg)} kg${loadSuffix[loadType] ?? ''}`;
}

// Only two personal bests per exercise: heaviest weight and most repetitions in one work set.
// Most reps ties go to the heavier weight, then to the more recent set.
export function recordHighlights(exercise) {
  const records = exercise.records ?? [];
  const load = records.find(record => record.metric === 'load') ?? null;
  const reps = records.filter(record => record.metric === 'reps').reduce((best, record) => {
    if (!best || record.value > best.value) return record;
    if (record.value < best.value) return best;
    const weightDelta = (record.weightKg ?? -1) - (best.weightKg ?? -1);
    if (weightDelta !== 0) return weightDelta > 0 ? record : best;
    return Date.parse(record.date) > Date.parse(best.date) ? record : best;
  }, null);
  return {
    maxWeight: load ? { value: recordWeightText(load.weightKg ?? load.value, exercise.loadType), date: shortDate(load.date), sessionId: load.sessionId } : null,
    maxReps: reps ? { value: `${number.format(reps.value)} Wdh.`, detail: `bei ${recordWeightText(reps.weightKg, exercise.loadType)}`, date: shortDate(reps.date), sessionId: reps.sessionId } : null,
  };
}

// Best values of one training: heaviest set and the set with most reps (ties -> heavier weight).
export function sessionBests(point) {
  const loads = point?.loads ?? [];
  const weighted = loads.filter(load => load.weightKg !== null && load.weightKg !== undefined);
  const heaviest = weighted.length ? weighted.reduce((best, load) => (load.weightKg > best.weightKg ? load : best)) : null;
  const mostReps = loads.length ? loads.reduce((best, load) => (load.reps > best.reps || (load.reps === best.reps && (load.weightKg ?? -1) > (best.weightKg ?? -1)) ? load : best)) : null;
  return { heaviest, mostReps };
}

export function RecordStat({ label, icon, stat, emptyText, onPress }) {
  const content = <>
    <View style={styles.recordStatHeader}>
      <Ionicons name={icon} size={s(12)} color={COLORS.softGold} />
      <Text style={styles.recordStatLabel}>{label}</Text>
    </View>
    {stat ? <>
      <Text style={styles.recordStatValue}>{stat.value}</Text>
      <Text style={styles.recordStatMeta}>{stat.detail ? `${stat.detail} · ` : ''}{stat.date}</Text>
    </> : <Text style={styles.recordStatEmpty}>{emptyText}</Text>}
  </>;
  if (!onPress || !stat) return <View style={styles.recordStat}>{content}</View>;
  return <Pressable accessibilityRole="button" accessibilityLabel={`${label}: ${stat.value}${stat.detail ? ` ${stat.detail}` : ''}, Training vom ${stat.date} öffnen`} onPress={onPress}
    style={({ pressed }) => [styles.recordStat, pressed && styles.planCardPressed]}>{content}</Pressable>;
}
export { number as recordNumber, shortDate as recordShortDate };

export function TrainingV2RecordCard({ exercise, onPress }) {
  const { maxWeight, maxReps } = recordHighlights(exercise);
  const label = [
    exercise.name,
    maxWeight ? `Max. Gewicht ${maxWeight.value}` : null,
    maxReps ? `Max. Wiederholungen ${maxReps.value} ${maxReps.detail}` : null,
    'Entwicklung öffnen',
  ].filter(Boolean).join(', ');
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress}
      style={({ pressed }) => [styles.planCard, styles.recordCard, pressed && styles.planCardPressed]}>
      <View style={styles.cardRow}>
        <View style={styles.planThumbnailPlaceholder}>
          <Ionicons name="trophy-outline" size={s(20)} color={COLORS.softGold} />
        </View>
        <View style={styles.cardBody}>
          <Text style={styles.cardName}>{exercise.name}</Text>
          <View style={styles.metaRow}>
            <Ionicons name="calendar-outline" size={s(12)} color={COLORS.textMuted} />
            <Text style={styles.meta}>{exercise.sessionCount} {exercise.sessionCount === 1 ? 'Training' : 'Trainings'}</Text>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={s(16)} color={COLORS.softGold} style={styles.cardChevron} />
      </View>
      <View style={styles.recordStatsRow}>
        <RecordStat label="Max. Gewicht" icon="barbell-outline" stat={maxWeight} emptyText={exercise.loadType === 'bodyweight_only' ? 'Körpergewicht' : '–'} />
        <RecordStat label="Max. Wdh." icon="repeat-outline" stat={maxReps} emptyText="–" />
      </View>
    </Pressable>
  );
}
