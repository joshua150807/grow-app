import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';

import { COLORS } from '../../../../constants/colors';
import { TrainingV2PlanSections } from '../components/TrainingV2PlanSections';
import { TrainingV2StateView } from '../components/TrainingV2StateView';
import { useTrainingV2Plans } from '../hooks/useTrainingV2Plans';
import { styles } from '../styles/trainingV2Styles';

export default function TrainingV2PlansScreen() {
  const { plans, loading, refreshing, error, retry, refresh } = useTrainingV2Plans();

  if (loading || error) {
    return <TrainingV2StateView loading={loading} error={error} onRetry={retry} />;
  }

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      refreshControl={(
        <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={COLORS.softGold} />
      )}
      style={styles.screen}
    >
      <View style={styles.topRow}>
        <Text onPress={() => router.back()} style={styles.backText}>‹ Zurück</Text>
        <Text style={styles.title}>Trainingspläne</Text>
        <Text
          onPress={() => router.push({ pathname: '/tools/training-v2-plan-editor' })}
          style={styles.editorLink}
        >
          + Neuer Plan
        </Text>
      </View>
      <Text style={styles.subtitle}>Alle Pläne in der vom Server vorgegebenen Reihenfolge.</Text>
      <TrainingV2PlanSections
        plans={plans}
        onPlanPress={(planId) => router.push({
          pathname: '/tools/training-v2-plan-detail',
          params: { planId },
        })}
      />
    </ScrollView>
  );
}

