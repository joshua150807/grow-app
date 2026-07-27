import { useEffect } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';

import { COLORS } from '../../../../constants/colors';
import { TrainingV2PlanCard } from '../components/TrainingV2PlanCard';
import { TrainingV2StateView } from '../components/TrainingV2StateView';
import { useTrainingV2Plans } from '../hooks/useTrainingV2Plans';
import {
  findActiveTrainingV2Plan,
  getTrainingV2HubRedirect,
} from '../models/trainingV2ViewModel';
import { styles } from '../styles/trainingV2Styles';

export default function TrainingV2HubScreen() {
  const { plans, loading, refreshing, error, retry, refresh } = useTrainingV2Plans();
  const activePlan = findActiveTrainingV2Plan(plans);

  useEffect(() => {
    const redirect = getTrainingV2HubRedirect({ plans, loading, error });
    if (redirect) router.replace(redirect);
  }, [error, loading, plans]);

  if (loading || error) {
    return <TrainingV2StateView loading={loading} error={error} onRetry={retry} />;
  }

  if (!activePlan) return <View style={styles.screen} />;

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      refreshControl={(
        <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={COLORS.softGold} />
      )}
      style={styles.screen}
    >
      <Text style={styles.title}>Mein Training</Text>
      <Text style={styles.subtitle}>Dein aktuell aktiver Trainingsplan.</Text>
      <TrainingV2PlanCard
        plan={activePlan}
        onPress={(planId) => router.push({
          pathname: '/tools/training-v2-plan-detail',
          params: { planId },
        })}
      />
    </ScrollView>
  );
}
