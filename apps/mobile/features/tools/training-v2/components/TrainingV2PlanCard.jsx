import { Pressable, Text, View } from 'react-native';

import { PLAN_STATUS_LABELS } from '../models/trainingV2ViewModel';
import { styles } from '../styles/trainingV2Styles';

export function TrainingV2PlanCard({ plan, onPress }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => onPress(plan.id)}
      style={[styles.planCard, plan.status === 'active' && styles.planCardActive]}
    >
      <View style={styles.cardTop}>
        <Text style={styles.cardName}>{plan.name}</Text>
        <Text style={styles.status}>{PLAN_STATUS_LABELS[plan.status]}</Text>
      </View>
      {plan.weeklyGoal !== null ? (
        <Text style={styles.meta}>Wochenziel: {plan.weeklyGoal}</Text>
      ) : null}
      {plan.schedule ? (
        <Text style={styles.meta}>
          Start: {plan.schedule.startDate} · {plan.schedule.timeZone}
        </Text>
      ) : null}
    </Pressable>
  );
}

