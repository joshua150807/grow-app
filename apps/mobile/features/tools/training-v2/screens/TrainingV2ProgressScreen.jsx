import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { styles } from '../styles/trainingV2Styles';
import { COLORS } from '../../../../constants/colors';
import { TrainingHistoryHeader, formatTrainingDuration, historyNumber } from '../components/TrainingV2HistoryViews';
import { TrainingV2StateView } from '../components/TrainingV2StateView';
import { a, analyticsDate, AnalyticsChart, AnalyticsEmpty, AnalyticsPeriods } from '../components/TrainingV2AnalyticsViews';
import { trainingDeviceTimeZone, useTrainingProgress } from '../hooks/useTrainingV2Analytics';
import { useTrainingV2ContentStyle } from '../hooks/useTrainingV2ContentStyle';

export default function TrainingV2ProgressScreen() {
  const [period, setPeriod] = useState('30'), [frequency, setFrequency] = useState('weeks');
  const [timeZone] = useState(trainingDeviceTimeZone);
  const contentStyle = useTrainingV2ContentStyle(), result = useTrainingProgress(period, timeZone), data = result.data;
  return <ScrollView style={styles.screen} contentContainerStyle={contentStyle} refreshControl={<RefreshControl refreshing={result.refreshing} onRefresh={result.refresh} tintColor={COLORS.softGold} />}>
    <TrainingHistoryHeader title="Trainingsfortschritt" />
    <Text style={styles.subtitle}>Dein Rhythmus. Deine gemessene Leistung.</Text>
    <AnalyticsPeriods period={period} onChange={setPeriod} />
    <TrainingV2StateView loading={result.loading} error={result.error} onRetry={result.retry} />
    {data ? <>
      <Text style={styles.formHint}>{analyticsDate(data.from)}–{analyticsDate(data.through)} · {data.timeZone}</Text>
      <View style={a.summary}>
        {[[String(data.completedSessions), 'Abgeschlossene Trainings'], [String(data.activeDays), 'Aktive Trainingstage'],
          [data.durationSeconds === null ? 'Nicht gemessen' : formatTrainingDuration(data.durationSeconds), 'Gemessene Trainingszeit'],
          [data.volumeKg === null ? 'Nicht berechenbar' : `${historyNumber.format(data.volumeKg)} kg·Wdh.`, 'Volumen erfasster Sätze']].map(([value, label]) => <View key={label} style={a.stat}><Text style={a.value}>{value}</Text><Text style={styles.exerciseNote}>{label}</Text></View>)}
      </View>
      <Text style={styles.formHint}>{data.measuredSessions} Trainings mit Zeitmessung · {data.unmeasuredSessions} ohne Zeitmessung. Fehlende Zeiten zählen nicht als 0 Minuten. Volumen verwendet wie die Historie alle erfassten Sätze mit berechenbarer Last, einschließlich Aufwärm- und Dropsätzen, hier nur aus abgeschlossenen Trainings. Reines Körpergewicht ist nicht in kg berechenbar.</Text>
      {!data.completedSessions ? <AnalyticsEmpty title="Noch kein abgeschlossenes Training in diesem Zeitraum">Wähle einen längeren Zeitraum oder schließe dein nächstes Training ab.</AnalyticsEmpty> : <>
        <View style={[a.wrap, a.wrapSpaced]}>{[['weeks', 'Pro Woche'], ['months', 'Pro Monat']].map(([value, label]) => <Pressable key={value} accessibilityRole="button" accessibilityState={{ selected: frequency === value }} onPress={() => setFrequency(value)} style={[a.choice, frequency === value && a.selected]}><Text style={styles.retryText}>{label}</Text></Pressable>)}</View>
        <AnalyticsChart title="Trainingshäufigkeit" points={data[frequency].map(bucket => ({ date: bucket.date, value: bucket.sessions }))} unit="Trainings" integer />
        <Text style={styles.formHint}>Wochen beginnen montags. Randwochen und Randmonate enthalten nur den ausgewählten Zeitraum.</Text>
        {data[frequency].map(bucket => <View key={bucket.date} style={a.record}><Text style={styles.exerciseName}>{frequency === 'weeks' ? 'Woche ab ' : 'Monat ab '}{analyticsDate(bucket.date)}</Text><Text style={styles.setText}>{bucket.sessions} Trainings · {bucket.activeDays} aktive Tage · {bucket.durationSeconds === null ? 'Dauer nicht gemessen' : formatTrainingDuration(bucket.durationSeconds)}</Text></View>)}
      </>}
    </> : null}
    <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/tools/training-v2-records', params: { mode: 'progress' } })} style={styles.actionButton}><Text style={styles.actionButtonText}>Entwicklung einer Übung ansehen</Text></Pressable>
  </ScrollView>;
}
