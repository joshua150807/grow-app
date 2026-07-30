import { useCallback, useEffect } from 'react';
import {
  ActivityIndicator, Alert, Pressable, ScrollView, Text, TextInput, View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useNavigation, usePreventRemove } from '@react-navigation/native';

import { COLORS } from '../../../../constants/colors';
import { TrainingV2StateView } from '../components/TrainingV2StateView';
import { TrainingV2UnitEditorCard } from '../components/TrainingV2UnitEditorCard';
import { useTrainingV2PlanDraft } from '../hooks/useTrainingV2PlanDraft';
import { useTrainingV2PlanEditor } from '../hooks/useTrainingV2PlanEditor';
import { styles } from '../styles/trainingV2Styles';

function saveErrorMessage(saveError) {
  if (!saveError) return null;
  if (saveError.type === 'validation') {
    return saveError.issues.map((issue) => issue.message).join('\n');
  }
  return saveError.error?.message ?? 'Der Plan konnte nicht gespeichert werden.';
}

export default function TrainingV2PlanEditorScreen() {
  const params = useLocalSearchParams();
  const planId = Array.isArray(params.planId) ? params.planId[0] : params.planId;
  const navigation = useNavigation();
  const {
    mode,
    state,
    initialState,
    expectedVersion,
    dispatch,
    loading,
    loadError,
    retryLoad,
    dirty,
    saving,
    saveError,
    conflict,
    save,
    reloadAfterConflict,
  } = useTrainingV2PlanEditor(planId);
  const draft = useTrainingV2PlanDraft({
    mode, planId, loading, state, dispatch, initialState, expectedVersion, dirty,
  });

  // usePreventRemove is the native-stack-aware primitive: it feeds the current dirty state
  // into the same shared context native-stack itself reads before letting an interactive
  // swipe-back gesture commit, so a swipe is intercepted before the native pop finishes.
  // A hand-rolled navigation-event subscription only learns about the removal after the JS
  // bridge round-trip, which is too late for a gesture-driven pop and is exactly what caused
  // screens to disappear natively while still being tracked in JS navigation state.
  usePreventRemove(dirty && !saving, ({ data }) => {
    Alert.alert(
      'Ungespeicherte Änderungen',
      'Möchtest du den Editor ohne Speichern verlassen?',
      [
        { text: 'Weiter bearbeiten', style: 'cancel' },
        {
          text: 'Verwerfen',
          style: 'destructive',
          onPress: () => navigation.dispatch(data.action),
        },
      ],
    );
  });

  // A version-conflicting local draft is a decision the user must make explicitly — a
  // dismissible banner risks being scrolled past or ignored while the screen silently keeps
  // showing whichever state (server or draft) happened to be on screen already. A native,
  // non-cancelable alert forces an explicit choice before anything else can happen, and
  // neither the server state nor the draft is touched until one of its two actions runs.
  useEffect(() => {
    if (!draft.draftConflict) return;
    Alert.alert(
      'Entwurf gefunden',
      'Für diesen Plan gibt es einen lokalen Entwurf, der Server-Stand hat sich aber inzwischen geändert.',
      [
        { text: 'Entwurf behalten', onPress: draft.keepDraft },
        { text: 'Aktuellen Plan laden', onPress: draft.loadCurrentPlanInstead },
      ],
      { cancelable: false },
    );
  }, [draft.draftConflict, draft.keepDraft, draft.loadCurrentPlanInstead]);

  const handleSave = useCallback(async () => {
    const outcome = await save();
    if (!outcome.ok) return;
    await draft.clearDraft();
    router.replace({ pathname: '/tools/training-v2-plan-detail', params: { planId: outcome.plan.id } });
  }, [save, draft]);

  if (loading) {
    return <TrainingV2StateView loading />;
  }
  if (loadError) {
    return <TrainingV2StateView error={loadError} onRetry={retryLoad} />;
  }

  const errorMessage = saveErrorMessage(saveError);

  return (
    <ScrollView contentContainerStyle={styles.content} style={styles.screen}>
      <View style={styles.topRow}>
        <Text onPress={() => router.back()} style={styles.backText}>‹ Zurück</Text>
        <Text style={styles.title}>{mode === 'create' ? 'Neuer Plan' : 'Plan bearbeiten'}</Text>
      </View>

      {draft.draftRestored && !draft.draftConflict ? (
        <View style={styles.conflictBanner}>
          <Text style={styles.conflictBannerText}>Entwurf wiederhergestellt.</Text>
          <Pressable accessibilityRole="button" onPress={draft.dismissDraftNotice} style={styles.retryButton}>
            <Text style={styles.retryText}>Verwerfen</Text>
          </Pressable>
        </View>
      ) : null}

      {conflict ? (
        <View style={styles.conflictBanner}>
          <Text style={styles.conflictBannerText}>
            Der Plan wurde in der Zwischenzeit auf dem Server geändert. Deine lokalen Änderungen wurden nicht überschrieben.
          </Text>
          <Pressable accessibilityRole="button" onPress={reloadAfterConflict} style={styles.retryButton}>
            <Text style={styles.retryText}>Aktuellen Serverstand laden</Text>
          </Pressable>
        </View>
      ) : null}

      {errorMessage && !conflict ? (
        <View style={styles.conflictBanner}>
          <Text style={styles.conflictBannerText}>{errorMessage}</Text>
        </View>
      ) : null}

      <View style={styles.formGroup}>
        <Text style={styles.formLabel}>Planname</Text>
        <TextInput
          onChangeText={(text) => dispatch({ type: 'SET_NAME', name: text })}
          placeholder="z. B. Push Pull Legs"
          placeholderTextColor="#6F6A77"
          style={styles.formInput}
          value={state.name}
        />
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.formLabel}>Wochenziel</Text>
        <TextInput
          editable={mode === 'create'}
          keyboardType="numeric"
          onChangeText={(text) => dispatch({ type: 'SET_WEEKLY_GOAL', weeklyGoal: text })}
          placeholder="z. B. 4"
          placeholderTextColor="#6F6A77"
          style={[styles.formInput, mode !== 'create' && styles.formInputDisabled]}
          value={state.weeklyGoal}
        />
        {mode === 'edit' ? (
          <Text style={styles.formHint}>Das Wochenziel wird an anderer Stelle verwaltet.</Text>
        ) : null}
      </View>

      {state.units.map((unit, unitIndex) => (
        <TrainingV2UnitEditorCard
          key={unit.logicalUnitKey}
          canMoveDown={unitIndex < state.units.length - 1}
          canMoveUp={unitIndex > 0}
          dispatch={dispatch}
          index={unitIndex}
          unit={unit}
        />
      ))}

      <Pressable accessibilityRole="button" onPress={() => dispatch({ type: 'ADD_UNIT' })} style={styles.addButton}>
        <Text style={styles.addButtonText}>+ Einheit hinzufügen</Text>
      </Pressable>

      <View style={styles.saveBar}>
        <Pressable
          accessibilityRole="button"
          disabled={saving}
          onPress={handleSave}
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
        >
          {saving ? (
            <ActivityIndicator color={COLORS.nearBlack} />
          ) : (
            <Text style={styles.saveButtonText}>
              {mode === 'create' ? 'Plan erstellen' : 'Änderungen speichern'}
            </Text>
          )}
        </Pressable>
      </View>
    </ScrollView>
  );
}
