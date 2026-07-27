import { useCallback, useState } from 'react';
import {
  ActivityIndicator, Alert, Pressable, ScrollView, Text, TextInput, View,
} from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useNavigation } from '@react-navigation/native';

import { COLORS } from '../../../../constants/colors';
import { TrainingV2ExercisePickerModal } from '../components/TrainingV2ExercisePickerModal';
import { TrainingV2StateView } from '../components/TrainingV2StateView';
import { TrainingV2UnitEditorCard } from '../components/TrainingV2UnitEditorCard';
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
  const [pickerTarget, setPickerTarget] = useState(null);

  useFocusEffect(useCallback(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (event) => {
      if (!dirty || saving) return;
      event.preventDefault();
      Alert.alert(
        'Ungespeicherte Änderungen',
        'Möchtest du den Editor ohne Speichern verlassen?',
        [
          { text: 'Weiter bearbeiten', style: 'cancel' },
          {
            text: 'Verwerfen',
            style: 'destructive',
            onPress: () => navigation.dispatch(event.data.action),
          },
        ],
      );
    });
    return unsubscribe;
  }, [navigation, dirty, saving]));

  const handleSave = useCallback(async () => {
    const outcome = await save();
    if (!outcome.ok) return;
    router.replace({ pathname: '/tools/training-v2-plan-detail', params: { planId: outcome.plan.id } });
  }, [save]);

  if (loading) {
    return <TrainingV2StateView loading />;
  }
  if (loadError) {
    return <TrainingV2StateView error={loadError} onRetry={retryLoad} />;
  }

  const errorMessage = saveErrorMessage(saveError);

  return (
    <>
      <ScrollView contentContainerStyle={styles.content} style={styles.screen}>
        <View style={styles.topRow}>
          <Text onPress={() => router.back()} style={styles.backText}>‹ Zurück</Text>
          <Text style={styles.title}>{mode === 'create' ? 'Neuer Plan' : 'Plan bearbeiten'}</Text>
        </View>

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
            onPickExercise={(logicalUnitKey, logicalTargetExerciseKey) => (
              setPickerTarget({ logicalUnitKey, logicalTargetExerciseKey })
            )}
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

      <TrainingV2ExercisePickerModal
        onClose={() => setPickerTarget(null)}
        onSelect={(exerciseId, exerciseName) => {
          dispatch({
            type: 'SET_EXERCISE_SELECTION',
            logicalUnitKey: pickerTarget.logicalUnitKey,
            logicalTargetExerciseKey: pickerTarget.logicalTargetExerciseKey,
            exerciseId,
            exerciseName,
          });
          setPickerTarget(null);
        }}
        visible={pickerTarget !== null}
      />
    </>
  );
}
