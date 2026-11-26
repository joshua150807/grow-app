import { Pressable, Text, View } from 'react-native';

import { getAvailableTrainingV2PlanActions } from '../models/trainingV2ViewModel';
import { styles } from '../styles/trainingV2Styles';

export function TrainingV2PlanActionsPanel({
  status,
  pending,
  onActivate,
  onSchedule,
  onArchive,
  onReactivate,
  onEditWeeklyGoal,
}) {
  const actions = getAvailableTrainingV2PlanActions(status);
  const disabled = pending !== null;
  const hasAnyAction = actions.canActivate || actions.canSchedule || actions.canArchive
    || actions.canReactivate || actions.canEditWeeklyGoal;

  if (!hasAnyAction) return null;

  return (
    <View style={styles.actionsPanel}>
      {actions.canActivate ? (
        <Pressable
          accessibilityRole="button"
          disabled={disabled}
          onPress={onActivate}
          style={[styles.actionButton, disabled && styles.actionButtonDisabled]}
        >
          <Text style={styles.actionButtonText}>Sofort aktivieren</Text>
        </Pressable>
      ) : null}
      {actions.canSchedule ? (
        <Pressable
          accessibilityRole="button"
          disabled={disabled}
          onPress={onSchedule}
          style={[styles.actionButtonSecondary, disabled && styles.actionButtonDisabled]}
        >
          <Text style={styles.actionButtonSecondaryText}>Vormerken</Text>
        </Pressable>
      ) : null}
      {actions.canReactivate ? (
        <Pressable
          accessibilityRole="button"
          disabled={disabled}
          onPress={onReactivate}
          style={[styles.actionButton, disabled && styles.actionButtonDisabled]}
        >
          <Text style={styles.actionButtonText}>Reaktivieren</Text>
        </Pressable>
      ) : null}
      {actions.canEditWeeklyGoal ? (
        <Pressable
          accessibilityRole="button"
          disabled={disabled}
          onPress={onEditWeeklyGoal}
          style={[styles.actionButtonSecondary, disabled && styles.actionButtonDisabled]}
        >
          <Text style={styles.actionButtonSecondaryText}>Wochenziel ändern</Text>
        </Pressable>
      ) : null}
      {actions.canArchive ? (
        <Pressable
          accessibilityRole="button"
          disabled={disabled}
          onPress={onArchive}
          style={[styles.actionButtonDanger, disabled && styles.actionButtonDisabled]}
        >
          <Text style={styles.actionButtonDangerText}>Archivieren</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
