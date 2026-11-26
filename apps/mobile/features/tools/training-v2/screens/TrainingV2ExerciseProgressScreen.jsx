import { useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { styles } from '../styles/trainingV2Styles';
import { COLORS } from '../../../../constants/colors';
import { s } from '../../../../constants/layout';
import { TrainingV2StateView } from '../components/TrainingV2StateView';
import { a, AnalyticsChart, AnalyticsEmpty, AnalyticsPeriods, loadLabels, openAnalyticsSession } from '../components/TrainingV2AnalyticsViews';
import { RecordStat, recordHighlights, recordNumber, recordShortDate, recordWeightText, sessionBests } from '../components/TrainingV2RecordCard';
import { trainingDeviceTimeZone, useTrainingExerciseProgress } from '../hooks/useTrainingV2Analytics';
import { useTrainingV2ContentStyle } from '../hooks/useTrainingV2ContentStyle';

const METRICS = [['weight', 'Gewicht'], ['reps', 'Wiederholungen']];
const WEIGHT_UNIT_SUFFIX = { per_hand: ' pro Hand', per_side: ' pro Seite', added_weight_only: ' Zusatzgewicht' };
const dayMonth = value => new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit' }).format(new Date(value));
const year = value => String(new Date(value).getFullYear());

function SessionRow({ point, loadType, bodyweight }) {
  const { heaviest, mostReps } = sessionBests(point);
  const parts = [
    !bodyweight && heaviest ? `Max. ${recordWeightText(heaviest.weightKg, loadType)}` : null,
    mostReps ? `Max. ${recordNumber.format(mostReps.reps)} Wdh.` : null,
  ].filter(Boolean);
  const date = recordShortDate(point.date);
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${point.sessionName} vom ${date}: ${parts.join(', ')}. Training öffnen`}
      onPress={() => openAnalyticsSession(point.sessionId)} style={({ pressed }) => [styles.planCard, pressed && styles.planCardPressed]}>
      <View style={styles.cardRow}>
        <View style={styles.recordDateBadge}>
          <Text style={styles.recordDateDay}>{dayMonth(point.date)}</Text>
          <Text style={styles.recordDateYear}>{year(point.date)}</Text>
        </View>
        <View style={styles.cardBody}>
          <Text style={styles.cardName}>{point.sessionName}</Text>
          <Text style={styles.meta}>{parts.join('  ·  ') || 'Keine vergleichbaren Werte'}</Text>
        </View>
        <Ionicons name="chevron-forward" size={s(16)} color={COLORS.softGold} style={styles.cardChevron} />
      </View>
    </Pressable>
  );
}

export default function TrainingV2ExerciseProgressScreen({ exerciseId }) {
  const [period, setPeriod] = useState('all'), [metric, setMetric] = useState('weight');
  const [timeZone] = useState(trainingDeviceTimeZone), contentStyle = useTrainingV2ContentStyle();
  useEffect(() => { setMetric('weight'); }, [exerciseId]);
  const result = useTrainingExerciseProgress(exerciseId, period, timeZone), data = result.data, exercise = data?.exercise;
  const bodyweight = exercise?.loadType === 'bodyweight_only';
  const activeMetric = bodyweight ? 'reps' : metric;
  const highlights = exercise ? recordHighlights(exercise) : null;
  const points = (data?.points ?? []).map(point => {
    const { heaviest, mostReps } = sessionBests(point);
    return { ...point, value: activeMetric === 'weight' ? heaviest?.weightKg ?? null : mostReps?.reps ?? null };
  });
  const weightUnit = `kg${WEIGHT_UNIT_SUFFIX[exercise?.loadType] ?? ''}`;
  return <ScrollView style={styles.screen} contentContainerStyle={contentStyle} refreshControl={<RefreshControl refreshing={result.refreshing} onRefresh={result.refresh} tintColor={COLORS.softGold} />}>
    <View style={styles.plansHeaderRow}>
      <Pressable accessibilityRole="button" accessibilityLabel="Zurück" onPress={() => router.back()} style={styles.plansBackRow}>
        <Ionicons name="chevron-back" size={s(20)} color={COLORS.softGold} />
        <Text style={styles.backText}>Zurück</Text>
      </Pressable>
      <Text accessibilityRole="header" style={styles.plansHeaderTitle}>{exercise?.name ?? 'Übung'}</Text>
    </View>
    {exercise ? <Text style={[styles.subtitle, styles.plansCenteredText]}>{loadLabels[exercise.loadType]} · {exercise.sessionCount} {exercise.sessionCount === 1 ? 'Training' : 'Trainings'}</Text> : null}
    <TrainingV2StateView loading={result.loading} error={result.error} onRetry={result.retry} />
    {exercise ? <>
      <Text style={[styles.sectionTitle, styles.plansCenteredText]}>Bestwerte</Text>
      <View style={[styles.recordStatsRow, styles.recordDetailStats]}>
        <RecordStat label="Max. Gewicht" icon="barbell-outline" stat={highlights.maxWeight} emptyText={bodyweight ? 'Körpergewicht' : '–'}
          onPress={highlights.maxWeight ? () => openAnalyticsSession(highlights.maxWeight.sessionId) : undefined} />
        <RecordStat label="Max. Wdh." icon="repeat-outline" stat={highlights.maxReps} emptyText="–"
          onPress={highlights.maxReps ? () => openAnalyticsSession(highlights.maxReps.sessionId) : undefined} />
      </View>

      <Text style={[styles.sectionTitle, styles.plansCenteredText]}>Entwicklung</Text>
      {!bodyweight ? <View style={[a.wrap, styles.recordChips]}>{METRICS.map(([value, label]) => <Pressable accessibilityRole="button" accessibilityState={{ selected: value === activeMetric }} key={value} onPress={() => setMetric(value)} style={[a.choice, value === activeMetric && a.selected]}><Text style={styles.retryText}>{label}</Text></Pressable>)}</View> : null}
      <AnalyticsPeriods period={period} onChange={setPeriod} />
      <View style={styles.recordChartCard}>
        <AnalyticsChart title={activeMetric === 'weight' ? 'Max. Gewicht pro Training' : 'Max. Wiederholungen pro Training'} unit={activeMetric === 'weight' ? weightUnit : 'Wdh.'} integer={activeMetric === 'reps'} points={points} />
      </View>

      {points.length ? <Text style={[styles.sectionTitle, styles.plansCenteredText]}>Trainings · {data.pagination.total}</Text> : null}
      {points.map(point => <SessionRow key={point.sessionId} point={point} loadType={exercise.loadType} bodyweight={bodyweight} />)}
      {data.pagination.hasMore ? <Pressable accessibilityRole="button" disabled={result.loadingMore || result.fetching} onPress={result.loadMore} style={styles.retryButton}><Text style={styles.retryText}>{result.loadingMore ? 'Wird geladen …' : 'Ältere Trainings laden'}</Text></Pressable> : null}
      {result.moreError ? <TrainingV2StateView error={result.moreError} onRetry={result.loadMore} /> : null}
      <Text style={[styles.formHint, styles.plansCenteredText]}>Gezählt werden Arbeitssätze aus abgeschlossenen Trainings, ohne Aufwärmsätze.</Text>
    </> : data ? <AnalyticsEmpty>Für diese Übung gibt es noch keine Werte aus abgeschlossenen Trainings.</AnalyticsEmpty> : null}
  </ScrollView>;
}
