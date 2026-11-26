import { ActivityIndicator, FlatList, Pressable, RefreshControl, Text, View } from 'react-native';

import { COLORS } from '../../../../constants/colors';
import {
  formatTrainingDuration, historyNumber, TrainingHistoryCard, TrainingHistoryHeader,
} from '../components/TrainingV2HistoryViews';
import { TrainingV2StateView } from '../components/TrainingV2StateView';
import { useTrainingV2History, useTrainingV2HistoryStats } from '../hooks/useTrainingV2History';
import { styles } from '../styles/trainingV2Styles';

export default function TrainingV2HistoryScreen() {
  const history = useTrainingV2History();
  const stats = useTrainingV2HistoryStats();
  const totals = stats.data;

  return (
    <FlatList
      style={styles.screen}
      contentContainerStyle={styles.content}
      data={history.data?.sessions ?? []}
      keyExtractor={(session) => session.id}
      renderItem={({ item }) => <TrainingHistoryCard session={item} />}
      refreshControl={(
        <RefreshControl
          refreshing={history.refreshing || stats.refreshing}
          onRefresh={() => { void history.refresh(); void stats.refresh(); }}
          tintColor={COLORS.softGold}
        />
      )}
      ListHeaderComponent={(
        <>
          <TrainingHistoryHeader title="Trainingshistorie" />
          {history.data && history.error ? <TrainingV2StateView error={history.error} onRetry={history.retry} /> : null}
          <View style={styles.section}>
            <Text accessibilityRole="header" style={styles.sectionTitle}>Statistik</Text>
            <TrainingV2StateView loading={stats.loading} error={stats.error} onRetry={stats.retry} />
            {totals ? (
              <View style={styles.planCard}>
                <Text style={styles.mtPlanCardName}>{historyNumber.format(totals.totalSessions)} protokollierte Trainings</Text>
                {totals.totalDurationSeconds > 0 ? (
                  <Text style={styles.mtPlanCardMeta}>{formatTrainingDuration(totals.totalDurationSeconds)} gemessene Trainingszeit</Text>
                ) : null}
                <Text style={styles.mtPlanCardMeta}>{historyNumber.format(totals.totalVolumeKg)} kg Gesamtvolumen</Text>
              </View>
            ) : null}
          </View>
        </>
      )}
      ListEmptyComponent={(
        <>
          <TrainingV2StateView loading={history.loading} error={history.error} onRetry={history.retry} />
          {history.data ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>Noch keine protokollierten Trainings</Text>
            </View>
          ) : null}
        </>
      )}
      ListFooterComponent={(
        <>
          <TrainingV2StateView error={history.moreError} onRetry={history.loadMore} />
          {history.loadingMore ? <ActivityIndicator color={COLORS.softGold} /> : null}
          {history.data?.pagination.hasMore && !history.loadingMore && !history.moreError ? (
            <Pressable accessibilityRole="button" onPress={history.loadMore} style={styles.retryButton}>
              <Text style={styles.retryText}>Weitere Trainings laden</Text>
            </Pressable>
          ) : null}
        </>
      )}
    />
  );
}
