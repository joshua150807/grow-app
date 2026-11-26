import { useEffect, useState } from 'react';
import { FlatList, Pressable, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { styles } from '../styles/trainingV2Styles';
import { COLORS } from '../../../../constants/colors';
import { s } from '../../../../constants/layout';
import { TrainingV2StateView } from '../components/TrainingV2StateView';
import { AnalyticsEmpty } from '../components/TrainingV2AnalyticsViews';
import { TrainingV2RecordCard } from '../components/TrainingV2RecordCard';
import { useTrainingRecords } from '../hooks/useTrainingV2Analytics';
import { useTrainingV2ContentStyle } from '../hooks/useTrainingV2ContentStyle';

export default function TrainingV2RecordsScreen({ mode }) {
  const contentStyle = useTrainingV2ContentStyle();
  const [input, setInput] = useState(''), [search, setSearch] = useState('');
  useEffect(() => { const timer = setTimeout(() => setSearch(input.trim()), 300); return () => clearTimeout(timer); }, [input]);
  const result = useTrainingRecords(search);
  const picking = mode === 'progress';
  const total = result.data?.pagination.total ?? 0;
  return <FlatList style={styles.screen} contentContainerStyle={contentStyle} keyboardShouldPersistTaps="handled"
    data={result.data?.exercises ?? []} keyExtractor={item => item.exerciseId}
    refreshing={result.refreshing} onRefresh={result.refresh}
    ListHeaderComponent={<>
      <View style={styles.plansHeaderRow}>
        <Pressable accessibilityRole="button" accessibilityLabel="Zurück" onPress={() => router.back()} style={styles.plansBackRow}>
          <Ionicons name="chevron-back" size={s(20)} color={COLORS.softGold} />
          <Text style={styles.backText}>Zurück</Text>
        </Pressable>
        <Text accessibilityRole="header" style={styles.plansHeaderTitle}>{picking ? 'Übung auswählen' : 'Persönliche Rekorde'}</Text>
      </View>
      <Text style={[styles.subtitle, styles.plansCenteredText]}>{picking ? 'Wähle eine Übung, um ihre Entwicklung zu sehen.' : 'Deine Bestwerte aus allen Trainings.'}</Text>
      <View style={styles.recordSearch}>
        <Ionicons name="search" size={s(16)} color={COLORS.textDim} />
        <TextInput accessibilityLabel="Übung suchen" placeholder="Übung suchen" placeholderTextColor={COLORS.textDim} value={input} onChangeText={setInput} style={styles.recordSearchInput} autoCorrect={false} />
      </View>
      {result.data && total > 0 ? <Text style={[styles.sectionTitle, styles.plansCenteredText]}>{total} {total === 1 ? 'Übung' : 'Übungen'}</Text> : null}
      <TrainingV2StateView loading={result.loading} error={result.error} onRetry={result.retry} />
    </>}
    renderItem={({ item }) => <TrainingV2RecordCard exercise={item}
      onPress={() => router.push({ pathname: '/tools/training-v2-exercise-progress', params: { exerciseId: item.exerciseId } })} />}
    ListEmptyComponent={!result.loading && !result.error ? <AnalyticsEmpty title={search ? 'Keine passende Übung' : 'Deine Bestleistungen beginnen hier'}>{search ? 'Versuche einen anderen Übungsnamen.' : 'Nach deinem ersten abgeschlossenen Training erscheinen hier deine Übungen mit ihren Bestwerten.'}</AnalyticsEmpty> : null}
    ListFooterComponent={result.data ? <View>
      {result.data.pagination.hasMore ? <Pressable accessibilityRole="button" disabled={result.loadingMore || result.fetching} onPress={result.loadMore} style={styles.retryButton}><Text style={styles.retryText}>{result.loadingMore ? 'Wird geladen …' : 'Weitere Übungen laden'}</Text></Pressable> : null}
      {result.moreError ? <TrainingV2StateView error={result.moreError} onRetry={result.loadMore} /> : null}
      {result.data.exercises.length ? <Text style={[styles.formHint, styles.plansCenteredText]}>Gezählt werden Arbeitssätze aus abgeschlossenen Trainings, ohne Aufwärmsätze.</Text> : null}
    </View> : null} />;
}
