import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, AppState, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useNavigation, usePreventRemove } from '@react-navigation/native';

import { COLORS } from '../../../../constants/colors';
import { useTrainingV2Session } from '../hooks/useTrainingV2Session';
import {
  hasSessionProgress, parseSessionRepsInput, parseSessionWeightInput, sessionProgressSummary,
} from '../models/trainingV2SessionModel';
import { getTrainingV2LastExerciseNote } from '../services/trainingV2Api';
import {
  adjustRestTimerEndsAt, elapsedRestSeconds, formatRestTimer, isRestTimerFinished, remainingRestSeconds,
} from '../models/trainingV2SessionTimer';
import { TrainingV2StateView } from '../components/TrainingV2StateView';
import { styles } from '../styles/trainingV2Styles';

function firstParam(value) {
  return Array.isArray(value) ? value[0] : value;
}

function targetHintText(set) {
  const parts = [];
  if (set.targetWeightKg !== null) parts.push(`${set.targetWeightKg} kg`);
  if (set.targetReps) {
    parts.push(set.targetReps.minimum === set.targetReps.maximum
      ? `${set.targetReps.minimum} Wdh.`
      : `${set.targetReps.minimum}–${set.targetReps.maximum} Wdh.`);
  }
  return parts.length ? `Ziel: ${parts.join(' · ')}` : null;
}

function saveErrorMessage(error) {
  return error?.message ?? 'Speichern fehlgeschlagen. Bitte versuche es erneut.';
}

function formatLastNoteDate(completedAtIso) {
  return new Date(completedAtIso).toLocaleDateString('de-DE');
}

// Read-only "Letzte Notiz" hint per exercise — fetched once per exercise id as soon as the
// session draft is known, and never fed back into `updateInput`/the note TextInput itself: this
// is purely a hint the user can read, not a value that gets copied into today's note. Keyed by
// exerciseId (not per set or per plan revision), matching the same identity the backend read
// resolves by (see trainingSessionRepository.ts findLastExerciseNote — "the same exercise"
// means the same catalog exercise, regardless of which plan/unit it was logged under).
function useLastExerciseNotes(exerciseIds) {
  const [notes, setNotes] = useState({});
  const key = exerciseIds.join(',');

  useEffect(() => {
    if (!key) return undefined;
    let cancelled = false;
    Promise.all([...new Set(key.split(','))].map(async (exerciseId) => {
      try {
        const result = await getTrainingV2LastExerciseNote(exerciseId);
        return [exerciseId, result.note ? result : null];
      } catch {
        return [exerciseId, null];
      }
    })).then((entries) => {
      if (!cancelled) setNotes(Object.fromEntries(entries.filter(([, value]) => value !== null)));
    });
    return () => { cancelled = true; };
  }, [key]);

  return notes;
}

// The rest timer runs entirely on absolute epoch-ms timestamps (draft.restTimer.endsAt), not a
// locally counted-down interval — a 1s tick just re-renders the remaining time, and an AppState
// 'active' resync recomputes it immediately, so backgrounding the app never lets the countdown
// drift or get stuck. Reaching zero on its own auto-dismisses the timer exactly like tapping
// "Überspringen" does, just with the full planned duration as the recorded actualRestSeconds.
function useRestTimerTick(restTimer, draft, dismissTimer) {
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    if (!restTimer) return undefined;
    const { exerciseIndex, setIndex, endsAt } = restTimer;
    const check = () => {
      const now = Date.now();
      setNowMs(now);
      if (isRestTimerFinished(endsAt, now)) {
        const completedAt = draft.exercises[exerciseIndex].sets[setIndex].completedAt;
        dismissTimer(elapsedRestSeconds(completedAt, now));
      }
    };
    check();
    const interval = setInterval(check, 1000);
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') check();
    });
    return () => {
      clearInterval(interval);
      subscription.remove();
    };
  }, [restTimer, draft, dismissTimer]);

  return nowMs;
}

function RestTimerOverlay({ draft, restTimer, nowMs, setTimerEndsAt, dismissTimer }) {
  const exercise = draft.exercises[restTimer.exerciseIndex];
  const set = exercise.sets[restTimer.setIndex];
  const remainingSeconds = remainingRestSeconds(restTimer.endsAt, nowMs);

  const adjust = (deltaSeconds) => {
    setTimerEndsAt(adjustRestTimerEndsAt(restTimer.endsAt, deltaSeconds, Date.now()));
  };
  const skip = () => {
    const now = Date.now();
    dismissTimer(elapsedRestSeconds(set.completedAt, now));
  };

  return (
    <View style={styles.restOverlay}>
      <Text style={styles.restOverlayLabel}>Satzpause</Text>
      <Text style={styles.restOverlayTimer}>{formatRestTimer(remainingSeconds)}</Text>
      <Text style={styles.restOverlayHint}>{exercise.exerciseName}</Text>
      <View style={styles.restAdjustRow}>
        <Pressable accessibilityRole="button" onPress={() => adjust(-30)} style={styles.restAdjustButton}>
          <Text style={styles.restAdjustButtonText}>−30s</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => adjust(30)} style={styles.restAdjustButton}>
          <Text style={styles.restAdjustButtonText}>+30s</Text>
        </Pressable>
      </View>
      <Pressable accessibilityRole="button" onPress={skip} style={styles.restSkipButton}>
        <Text style={styles.restSkipButtonText}>Überspringen</Text>
      </Pressable>
    </View>
  );
}

function SessionSetRow({
  set, exerciseIndex, setIndex, updateInput, completeSet, uncompleteSet,
}) {
  const hint = targetHintText(set);
  return (
    <View style={styles.sessionSetBlock}>
      <View style={styles.sessionSetHeaderRow}>
        <Text style={styles.sessionSetLabel}>Satz {setIndex + 1}</Text>
        {hint ? <Text style={styles.sessionSetHint}>{hint}</Text> : null}
      </View>
      <View style={styles.targetSetRow}>
        <View style={styles.targetSetFieldGroup}>
          <Text style={styles.targetSetFieldLabel}>kg</Text>
          <TextInput
            accessibilityLabel="Gewicht in kg"
            editable={!set.completed}
            keyboardType="decimal-pad"
            onChangeText={(text) => updateInput(exerciseIndex, setIndex, { weightKg: parseSessionWeightInput(text) })}
            placeholder="kg"
            placeholderTextColor={COLORS.textFaint}
            style={[styles.targetSetInput, set.completed && styles.sessionSetInputDisabled]}
            value={set.weightKg === null ? '' : String(set.weightKg)}
          />
        </View>
        <View style={styles.targetSetFieldGroup}>
          <Text style={styles.targetSetFieldLabel}>Wiederholungen</Text>
          <TextInput
            accessibilityLabel="Wiederholungen"
            editable={!set.completed}
            keyboardType="number-pad"
            onChangeText={(text) => updateInput(exerciseIndex, setIndex, { reps: parseSessionRepsInput(text) })}
            placeholder="Wdh."
            placeholderTextColor={COLORS.textFaint}
            style={[styles.targetSetInput, set.completed && styles.sessionSetInputDisabled]}
            value={set.reps === null ? '' : String(set.reps)}
          />
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={() => (set.completed
            ? uncompleteSet(exerciseIndex, setIndex)
            : completeSet(exerciseIndex, setIndex))}
          style={[styles.sessionCompleteButton, set.completed && styles.sessionCompleteButtonDone]}
        >
          <Text style={[styles.sessionCompleteButtonText, set.completed && styles.sessionCompleteButtonTextDone]}>
            {set.completed ? 'Erledigt' : 'Fertig'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function TrainingV2SessionActiveScreen() {
  const params = useLocalSearchParams();
  const planId = firstParam(params.planId);
  const unitId = firstParam(params.unitId);
  const navigation = useNavigation();

  const {
    draft, loading, error, retryLoad, updateInput, updateNote, completeSet, uncompleteSet,
    setTimerEndsAt, dismissTimer, discard, save, saving, saveError, clearSaveError,
  } = useTrainingV2Session(planId, unitId);

  const restTimer = draft?.restTimer ?? null;
  const nowMs = useRestTimerTick(restTimer, draft, dismissTimer);
  const lastNotes = useLastExerciseNotes(draft ? draft.exercises.map((exercise) => exercise.exerciseId) : []);

  // Set only by finishSave, immediately before its own post-save router.back() — the one
  // navigation this screen ever triggers itself, already confirmed by the user's own "Training
  // abschließen"/"Unvollständig beenden" tap. Read once, then reset, so it never leaks into
  // covering an unrelated later leave attempt.
  const bypassLeaveGuardRef = useRef(false);

  // The single guard for every way this screen can be left — header "Zurück", Android
  // hardware back, and an interactive iOS swipe all funnel through the same native-stack
  // beforeRemove event, exactly like TrainingV2PlanEditorScreen's own usePreventRemove use
  // (see its comment: a hand-rolled listener races an interactive swipe-back, usePreventRemove
  // does not). Armed as soon as a session draft exists at all — not gated on
  // hasSessionProgress() — since a draft is created and persisted the moment this screen loads
  // (see useTrainingV2Session's load()), so leaving without going through one of the three
  // options below would otherwise silently strand that persisted draft.
  //
  // Staying armed for the *entire* duration of an in-flight save (not just until the tap that
  // started it) matters: `saving` can stay true for a real network round-trip, and gating the
  // boolean passed to usePreventRemove on `!saving` used to disarm the guard for that whole
  // window — a concurrent hardware-back/swipe/header-tap during that window then bypassed the
  // dialog entirely and navigated away unconfirmed, racing finishSave's own post-save
  // navigation (a silent fourth leave path, and a possible double navigation). A save already
  // in flight is instead handled inside the callback below (see `if (saving) return;`), which
  // blocks a second, concurrent leave attempt without popping a second dialog and without ever
  // letting it slip through unconfirmed.
  usePreventRemove(Boolean(draft), ({ data }) => {
    if (bypassLeaveGuardRef.current) {
      bypassLeaveGuardRef.current = false;
      navigation.dispatch(data.action);
      return;
    }
    if (saving) return;
    Alert.alert(
      'Training verlassen?',
      'Du hast in dieser Einheit noch nicht gespeicherte Eingaben.',
      [
        { text: 'Training fortsetzen', style: 'cancel' },
        {
          text: 'Unvollständig speichern',
          onPress: async () => {
            const outcome = await save('incomplete');
            if (outcome.ok) navigation.dispatch(data.action);
          },
        },
        {
          text: 'Training verwerfen',
          style: 'destructive',
          onPress: async () => {
            await discard();
            navigation.dispatch(data.action);
          },
        },
      ],
    );
  });

  if (loading || error) {
    return <TrainingV2StateView loading={loading} error={error} onRetry={retryLoad} />;
  }
  if (!draft) return null;

  if (restTimer) {
    return (
      <RestTimerOverlay
        draft={draft}
        dismissTimer={dismissTimer}
        nowMs={nowMs}
        restTimer={restTimer}
        setTimerEndsAt={setTimerEndsAt}
      />
    );
  }

  const finishSave = async (status) => {
    clearSaveError();
    const outcome = await save(status);
    if (outcome.ok) {
      bypassLeaveGuardRef.current = true;
      router.back();
    }
  };

  const { completedSets, totalSets } = sessionProgressSummary(draft);

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.topRow}>
          <Text onPress={() => router.back()} style={styles.backText}>‹ Zurück</Text>
          <Text style={styles.title}>{draft.unitName}</Text>
        </View>
        <Text style={styles.detailMeta}>{draft.planName}</Text>

        {draft.exercises.map((exercise, exerciseIndex) => (
          <View key={exercise.logicalTargetExerciseKey} style={styles.unitCard}>
            <Text style={styles.unitName}>{exercise.exerciseName}</Text>
            {lastNotes[exercise.exerciseId] ? (
              <Text style={styles.lastNoteText}>
                Letzte Notiz ({formatLastNoteDate(lastNotes[exercise.exerciseId].completedAt)}): {lastNotes[exercise.exerciseId].note}
              </Text>
            ) : null}
            <TextInput
              accessibilityLabel="Notiz zur Übung"
              onChangeText={(text) => updateNote(exerciseIndex, text)}
              placeholder="Notiz zur Übung (optional)"
              placeholderTextColor={COLORS.textFaint}
              style={styles.sessionNoteInput}
              value={exercise.note ?? ''}
            />
            {exercise.sets.map((set, setIndex) => (
              <SessionSetRow
                key={set.clientSetId}
                completeSet={completeSet}
                exerciseIndex={exerciseIndex}
                set={set}
                setIndex={setIndex}
                uncompleteSet={uncompleteSet}
                updateInput={updateInput}
              />
            ))}
          </View>
        ))}

        <View style={styles.saveBar}>
          <Text style={styles.sessionProgressText}>{completedSets} von {totalSets} Sätzen erledigt</Text>
          {saveError ? <Text style={styles.formErrorText}>{saveErrorMessage(saveError)}</Text> : null}
          <Pressable
            accessibilityRole="button"
            disabled={saving}
            onPress={() => finishSave('completed')}
            style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          >
            {saving ? <ActivityIndicator color={COLORS.nearBlack} /> : <Text style={styles.saveButtonText}>Training abschließen</Text>}
          </Pressable>
          {hasSessionProgress(draft) ? (
            <Pressable
              accessibilityRole="button"
              disabled={saving}
              onPress={() => finishSave('incomplete')}
              style={[styles.actionButtonSecondary, saving && styles.actionButtonDisabled]}
            >
              <Text style={styles.actionButtonSecondaryText}>Unvollständig beenden</Text>
            </Pressable>
          ) : null}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
