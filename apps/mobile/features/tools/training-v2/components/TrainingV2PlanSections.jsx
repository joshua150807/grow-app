import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { COLORS } from '../../../../constants/colors';
import { s } from '../../../../constants/layout';
import { styles } from '../styles/trainingV2Styles';
import { TrainingV2PlanCard } from './TrainingV2PlanCard';
import { TrainingV2TemplateCard } from './TrainingV2TemplateCard';

// Two flat lists, in the server's own order, no status sections and no archive UI:
// "Grow-Trainingspläne" always shows every active template regardless of saved/active state
// (see TrainingV2PlansScreen and selectTrainingV2SavedPlans in trainingV2ViewModel.js), and
// "Gespeicherte Pläne" is the caller's already-filtered savedPlans list — a self-created plan
// must never disappear from it just because it was archived, so no further filtering happens
// here.
export function TrainingV2PlanSections({
  templates, savedPlans, onTemplatePress, onPlanPress,
}) {
  return (
    <>
      {templates.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Grow-Trainingspläne</Text>
          {templates.map((item) => (
            <TrainingV2TemplateCard key={item.template.id} item={item} onPress={onTemplatePress} />
          ))}
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Gespeicherte Pläne</Text>
        {savedPlans.length === 0 ? (
          <View style={styles.plansEmptyCard}>
            <Ionicons name="barbell-outline" size={s(28)} color={COLORS.goldBorderLight} />
            <Text style={styles.plansEmptyTitle}>Noch keine gespeicherten Pläne</Text>
            <Text style={styles.plansEmptyText}>
              Speichere einen Grow-Trainingsplan oder erstelle deinen eigenen — er erscheint dann hier.
            </Text>
          </View>
        ) : savedPlans.map((plan) => (
          <TrainingV2PlanCard key={plan.id} plan={plan} onPress={onPlanPress} />
        ))}
      </View>
    </>
  );
}
