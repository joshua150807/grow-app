import { useCallback } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';

import { COLORS } from '../../../../constants/colors';
import { useTrainingV2Plans } from '../hooks/useTrainingV2Plans';
import { useTrainingV2TemplateActions } from '../hooks/useTrainingV2TemplateActions';
import { useTrainingV2TemplateDetail } from '../hooks/useTrainingV2TemplateDetail';
import { targetSetLabel } from '../models/trainingV2ViewModel';
import { styles } from '../styles/trainingV2Styles';
import { useTrainingV2ContentStyle } from '../hooks/useTrainingV2ContentStyle';
import { TrainingV2StateView } from '../components/TrainingV2StateView';
import TrainingV2OwnPlanDetail from './TrainingV2OwnPlanDetail';

function actionErrorMessage(error) {
  if (!error) return null;
  return error.message ?? 'Die Aktion konnte nicht ausgeführt werden.';
}

// A Grow template's detail view — reachable both from the Grow-Trainingspläne list (never
// touched by this user yet) and from a saved/active Grow entry in the Saved list. Either way
// this always reads by templateId, never planId: Save/Unsave/Activate are template-keyed
// server actions (see trainingTemplateSaveRepository.ts) that transparently create the
// user's own plan copy on first use — there is nothing to branch on here. No edit flow: Grow
// content is immutable; editing only ever applies to a user's own plans.
export default function TrainingV2GrowPlanDetail({ templateId, planId }) {
  const contentStyle = useTrainingV2ContentStyle();
  const {
    template, loading, refreshing, error, retry, refresh,
  } = useTrainingV2TemplateDetail(templateId);
  const actions = useTrainingV2TemplateActions(templateId, () => refresh());
  const { plans: allPlans } = useTrainingV2Plans();

  const handleReload = useCallback(() => {
    actions.clearError();
    void retry();
  }, [actions, retry]);

  const handleActivate = useCallback(() => {
    const otherActivePlan = allPlans.some((candidate) => (
      candidate.status === 'active' && candidate.id !== template.userPlanId
    ));
    if (!otherActivePlan) {
      void actions.activate();
      return;
    }
    Alert.alert(
      'Plan sofort aktivieren',
      'Ein aktuell aktiver Plan wird dabei automatisch archiviert. Fortfahren?',
      [
        { text: 'Abbrechen', style: 'cancel' },
        { text: 'Bestätigen', style: 'destructive', onPress: () => { void actions.activate(); } },
      ],
    );
  }, [actions, allPlans, template]);

  const handleToggleSaved = useCallback(() => {
    void (template.isSaved ? actions.unsave() : actions.save());
  }, [actions, template]);

  // Existing user instances remain usable when a source template is unpublished.
  // Their detail view is read-only for Grow content as well.
  if (!loading && error?.status === 404 && planId) return <TrainingV2OwnPlanDetail planId={planId} />;
  if (!template && (loading || error)) {
    return <TrainingV2StateView loading={loading} error={error} onRetry={retry} />;
  }
  if (!template) return null;

  return (
    <ScrollView
      contentContainerStyle={contentStyle}
      refreshControl={(
        <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={COLORS.softGold} />
      )}
      style={styles.screen}
    >
      <View style={styles.topRow}>
        <Text onPress={() => router.back()} style={styles.backText}>‹ Zurück</Text>
        <Text style={styles.title}>Plandetail</Text>
      </View>

      {error ? <TrainingV2StateView error={error} onRetry={retry} /> : null}
      {actions.error ? (
        <View style={styles.conflictBanner}>
          <Text style={styles.conflictBannerText}>{actionErrorMessage(actions.error)}</Text>
          <Pressable accessibilityRole="button" onPress={handleReload} style={styles.retryButton}>
            <Text style={styles.retryText}>Aktuellen Serverstand laden</Text>
          </Pressable>
        </View>
      ) : null}

      <View style={styles.detailHeader}>
        {template.isActive ? (
          <View style={styles.detailStatusRow}>
            <View style={[styles.statusBadge, styles.statusBadgeActive, styles.detailStatusBadge]}>
              <Text style={[styles.statusBadgeText, styles.statusBadgeTextActive]}>Aktiv</Text>
            </View>
          </View>
        ) : null}
        <Text style={styles.detailName}>{template.name}</Text>
        <Text style={styles.detailMeta}>Revision {template.revision.revisionNumber}</Text>
        {template.description ? <Text style={styles.detailMeta}>{template.description}</Text> : null}
      </View>

      <View style={styles.actionsPanel}>
        {!template.isActive ? (
          <Pressable
            accessibilityRole="button"
            disabled={actions.pending !== null}
            onPress={handleActivate}
            style={[styles.actionButton, actions.pending !== null && styles.actionButtonDisabled]}
          >
            <Text style={styles.actionButtonText}>Jetzt aktivieren</Text>
          </Pressable>
        ) : null}
        <Pressable
          accessibilityRole="button"
          disabled={actions.pending !== null}
          onPress={handleToggleSaved}
          style={[styles.actionButtonSecondary, actions.pending !== null && styles.actionButtonDisabled]}
        >
          <Text style={styles.actionButtonSecondaryText}>
            {template.isSaved ? 'Nicht mehr speichern' : 'Speichern'}
          </Text>
        </Pressable>
      </View>

      {template.units.map((unit) => (
        <View key={unit.id} style={styles.unitCard}>
          <Text style={styles.unitName}>{unit.name}</Text>
          <Text style={styles.unitType}>{unit.unitTypeLabel}</Text>
          {unit.exercises.map((exercise) => (
            <View key={exercise.id} style={styles.exercise}>
              <Text style={styles.exerciseName}>{exercise.exerciseName}</Text>
              {exercise.note ? <Text style={styles.exerciseNote}>{exercise.note}</Text> : null}
              {exercise.targetSets.map((targetSet, index) => (
                <Text key={targetSet.id} style={styles.setText}>
                  Satz {index + 1}: {targetSetLabel(targetSet)}
                </Text>
              ))}
            </View>
          ))}
        </View>
      ))}
    </ScrollView>
  );
}
