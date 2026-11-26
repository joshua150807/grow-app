import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { COLORS } from '../../../../constants/colors';
import { styles } from '../styles/trainingV2Styles';
import { historyNumber } from './TrainingV2HistoryViews';

export const loadLabels = { total_weight: 'Gesamtgewicht', per_hand: 'Gewicht pro Hand', per_side: 'Gewicht pro Seite', added_weight_only: 'Zusatzgewicht', bodyweight_only: 'Körpergewicht', no_weight_tracking: 'Ohne Gewichtserfassung' };
export const metricLabels = { load: 'Höchste Last', reps: 'Wiederholungen', set_volume: 'Bestes Satzvolumen', session_volume: 'Übungsvolumen pro Training' };
export const recordUnit = metric => metric === 'reps' ? 'Wdh.' : metric === 'load' ? 'kg' : 'kg·Wdh.';
export const analyticsDate = value => new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit', ...(/^\d{4}-\d{2}-\d{2}$/.test(value) ? { timeZone: 'UTC' } : {}) }).format(new Date(value));
export const openAnalyticsSession = sessionId => router.push({ pathname: '/tools/training-v2-session-detail', params: { sessionId } });
export function AnalyticsPeriods({ period, onChange }) {
  return <View style={a.wrap}>{[['7', '7 Tage'], ['30', '30 Tage'], ['90', '90 Tage'], ['all', 'Gesamt']].map(([value, label]) => <Pressable key={value} accessibilityRole="button" accessibilityState={{ selected: period === value }} onPress={() => onChange(value)} style={[a.choice, period === value && a.selected]}><Text style={styles.retryText}>{label}</Text></Pressable>)}</View>;
}
export function AnalyticsEmpty({ title = 'Noch keine Leistungsdaten', children }) {
  return <View style={styles.emptyCard}><Text style={styles.emptyTitle}>{title}</Text><Text style={styles.emptyText}>{children ?? 'Nach einem abgeschlossenen und gespeicherten Training erscheinen hier geeignete Arbeitssätze.'}</Text></View>;
}
export function AnalyticsRecord({ record }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={`${metricLabels[record.metric]}: ${historyNumber.format(record.value)} ${recordUnit(record.metric)}. Training vom ${analyticsDate(record.date)} öffnen`} onPress={() => openAnalyticsSession(record.sessionId)} style={a.record}>
    <Text style={styles.exerciseName}>{metricLabels[record.metric]}{record.metric === 'reps' && record.weightKg !== null ? ` bei ${historyNumber.format(record.weightKg)} kg` : ''}</Text>
    <Text style={a.value}>{historyNumber.format(record.value)} {recordUnit(record.metric)}</Text>
    <Text style={styles.exerciseNote}>{analyticsDate(record.date)} · {record.sessionName}{record.ties ? ` · ${record.ties}× erneut erreicht` : ''} →</Text>
  </Pressable>;
}
export function analyticsPointValue(point, metric, loadType, weightKg) {
  if (metric === 'session_volume') return point.volumeKg;
  if (metric === 'set_volume') return point.bestSetVolumeKg;
  if (metric === 'reps') return point.loads.find(load => load.weightKg === (loadType === 'bodyweight_only' ? null : weightKg))?.reps ?? null;
  const loads = point.loads.map(load => load.weightKg).filter(value => value !== null);
  return loads.length ? Math.max(...loads) : null;
}
// Y axis: 0 to a rounded top value in 1/2/2.5/5·10^n steps (whole steps for counts).
export function analyticsAxisTicks(max, { integer = false, count = 4 } = {}) {
  const safeMax = Math.max(Number.isFinite(max) ? max : 0, integer ? 1 : 1e-9);
  const raw = safeMax / count, magnitude = 10 ** Math.floor(Math.log10(raw));
  let step = [1, 2, 2.5, 5, 10].map(factor => factor * magnitude).find(candidate => candidate >= raw - 1e-12);
  if (integer) step = Math.max(1, Math.ceil(step));
  const steps = Math.max(1, Math.ceil(safeMax / step - 1e-9));
  return [...Array(steps + 1).keys()].map(index => Number((index * step).toFixed(10)));
}
// Discrete observations positioned by their real timestamps. No interpolated line.
export function analyticsChartGeometry(points, width = 300, { integer = false } = {}) {
  const valid = points.filter(point => Number.isFinite(point.value) && point.value >= 0 && Number.isFinite(Date.parse(point.date)));
  if (!valid.length) return { points: [], max: 0, ticks: [] };
  const times = valid.map(point => Date.parse(point.date)), first = Math.min(...times), last = Math.max(...times);
  const max = Math.max(...valid.map(point => point.value), 1);
  const ticks = analyticsAxisTicks(max, { integer }), axisMax = ticks.at(-1);
  return { max, axisMax, ticks: ticks.map(value => ({ value, y: analyticsY(value, axisMax) })), points: valid.map(point => ({ ...point, x: last === first ? width / 2 : 8 + (Date.parse(point.date) - first) / (last - first) * (width - 16), y: analyticsY(point.value, axisMax) })) };
}
const analyticsY = (value, axisMax) => 130 - value / axisMax * 120;
export function AnalyticsChart({ title, points, unit, integer = false }) {
  const width = Math.max(280, Math.min(points.length * 24, 1800));
  const geometry = analyticsChartGeometry(points, width, { integer });
  const ordered = [...geometry.points].sort((left, right) => left.date.localeCompare(right.date));
  if (!ordered.length) return <Text style={styles.emptyText}>Keine vergleichbaren Messwerte in diesem Zeitraum.</Text>;
  return <View style={a.chartCard}>
    <Text style={styles.sectionTitle}>{title}</Text>
    <Text style={styles.formHint}>Y-Achse: {unit} · einzelne Messpunkte</Text>
    <View style={a.chartRow}>
      <View style={a.yAxis} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">{geometry.ticks.map(tick => <Text key={tick.value} numberOfLines={1} style={[a.yLabel, { top: tick.y - 7 }]}>{historyNumber.format(tick.value)}</Text>)}</View>
      <ScrollView horizontal showsHorizontalScrollIndicator style={a.chartScroll}>
        <View style={{ width }}>
          <View style={a.plot}>
            {geometry.ticks.map(tick => <View key={tick.value} style={[a.gridLine, { top: tick.y }]} />)}
            {geometry.points.map((point, index) => <Pressable key={`${point.date}:${index}`} accessibilityRole={point.sessionId ? 'button' : 'text'} accessibilityLabel={`${analyticsDate(point.date)}: ${historyNumber.format(point.value)} ${unit}`} disabled={!point.sessionId} onPress={() => openAnalyticsSession(point.sessionId)} style={[a.pointTouch, { left: point.x - 12, top: point.y - 12 }]}><View style={a.point} /></Pressable>)}
          </View>
          <View style={a.axis}><Text style={styles.formHint}>{analyticsDate(ordered[0].date)}</Text><Text style={styles.formHint}>{analyticsDate(ordered.at(-1).date)}</Text></View>
        </View>
      </ScrollView>
    </View>
    <Text style={styles.formHint}>Die Abstände entsprechen den Datumsabständen. Details stehen unter dem Diagramm.</Text>
  </View>;
}
export const a = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  wrapSpaced: { marginTop: 20 },
  choice: { minHeight: 44, padding: 12, borderRadius: 14, borderWidth: 1, borderColor: COLORS.borderSubtle, justifyContent: 'center' },
  selected: { borderColor: COLORS.softGold, backgroundColor: 'rgba(231,201,138,0.12)' },
  record: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.borderSubtle },
  value: { color: COLORS.paleGold, fontSize: 21, fontWeight: '800', marginTop: 6 },
  chartCard: { paddingVertical: 16 }, plot: { height: 150, borderBottomWidth: 1, borderBottomColor: COLORS.borderSubtle, marginTop: 12 },
  pointTouch: { position: 'absolute', width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  point: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.softGold },
  axis: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  chartRow: { flexDirection: 'row' }, chartScroll: { flex: 1 },
  yAxis: { width: 40, height: 150, marginTop: 12, marginRight: 4 },
  yLabel: { position: 'absolute', right: 0, left: 0, textAlign: 'right', fontSize: 11, lineHeight: 14, color: COLORS.textMuted },
  gridLine: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: COLORS.borderSubtle },
  summary: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 18 },
  stat: { minWidth: 130, flexGrow: 1, padding: 14, borderWidth: 1, borderColor: COLORS.borderSubtle, borderRadius: 16 },
});
