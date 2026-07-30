import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { useTrainingV2ExercisePicker } from '../hooks/useTrainingV2ExercisePicker';
import { styles } from '../styles/trainingV2Styles';
import { cleanExerciseName } from '../utils/trainingV2ExerciseName';
import { UI_MUSCLE_GROUPS, uiMuscleGroupLabel } from '../utils/trainingV2MuscleGroups';

const SEARCH_DEBOUNCE_MS = 300;

// Replaces the old full-screen picker modal: tapping the exercise name/placeholder turns it
// into a text field at the same position with a small suggestion dropdown directly below it.
// No modal, no separate screen, no dedicated create-exercise button — an unmatched confirmed
// name always becomes a local exerciseDraft instead (see SET_EXERCISE_DRAFT in
// trainingV2EditorModel.js); the plan editor never calls POST /training/exercises.
export function TrainingV2InlineExercisePicker({
  dispatch, logicalUnitKey, logicalTargetExerciseKey, exercise,
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState('');
  const [muscleMenuOpen, setMuscleMenuOpen] = useState(false);
  const {
    results, exactMatch, search, reset,
  } = useTrainingV2ExercisePicker();
  const confirmingRef = useRef(false);
  // Tapping a suggestion while the TextInput is still focused blurs it as part of the same
  // touch gesture — on both platforms the native blur reliably reaches onBlur before the
  // Pressable's onPress (touch-release) does, so onBlur's own confirm would otherwise win
  // and turn the still-typed partial text ("bein") into a draft before the tap is ever
  // processed. onPressIn fires on touch-DOWN, at or before that blur, so marking here (and
  // checking it at the very top of confirmTypedText) reliably suppresses blur's own confirm
  // for the duration of the tap — no timeout, just the actual touch sequence. onPressOut
  // resets it unconditionally so a cancelled/dragged-away touch (onPressIn without a
  // following onPress) can never leave future blurs permanently suppressed.
  const suggestionTapRef = useRef(false);

  const hasSelection = Boolean(exercise.exerciseId) || Boolean(exercise.exerciseDraft);

  useEffect(() => {
    if (!editing) {
      reset();
      return undefined;
    }
    const trimmed = text.trim();
    if (!trimmed) {
      reset();
      return undefined;
    }
    const timeout = setTimeout(() => {
      void search({ search: trimmed });
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing, text]);

  function startEditing() {
    setText(exercise.exerciseName);
    setMuscleMenuOpen(false);
    setEditing(true);
  }

  function selectSuggestion(item) {
    if (confirmingRef.current) return;
    confirmingRef.current = true;
    dispatch({
      type: 'SET_EXERCISE_SELECTION',
      logicalUnitKey,
      logicalTargetExerciseKey,
      exerciseId: item.id,
      exerciseName: item.name,
      mainMuscle: item.mainMuscle,
    });
    setEditing(false);
    confirmingRef.current = false;
  }

  async function confirmTypedText() {
    // A suggestion tap is already in flight (or just landed) — it always wins over blur;
    // its own onPress handles the selection, so this must not also confirm the raw typed
    // text as a draft.
    if (suggestionTapRef.current) return;
    if (confirmingRef.current) return;
    confirmingRef.current = true;
    try {
      const cleaned = cleanExerciseName(text);
      if (!cleaned) {
        dispatch({ type: 'REMOVE_EXERCISE', logicalUnitKey, logicalTargetExerciseKey });
        return;
      }

      // The debounced live search may still be in flight or stale relative to the exact text
      // being confirmed right now (Fertig/blur can fire before the last keystroke's debounce
      // settles) — re-check directly so this decision never relies on timing.
      const fresh = await search({ search: cleaned });
      if (fresh.exactMatch) {
        dispatch({
          type: 'SET_EXERCISE_SELECTION',
          logicalUnitKey,
          logicalTargetExerciseKey,
          exerciseId: fresh.exactMatch.id,
          exerciseName: fresh.exactMatch.name,
          mainMuscle: fresh.exactMatch.mainMuscle,
        });
      } else {
        dispatch({
          type: 'SET_EXERCISE_DRAFT', logicalUnitKey, logicalTargetExerciseKey, name: cleaned,
        });
      }
    } finally {
      setEditing(false);
      confirmingRef.current = false;
    }
  }

  function clearRow() {
    dispatch({ type: 'REMOVE_EXERCISE', logicalUnitKey, logicalTargetExerciseKey });
  }

  function selectMuscleGroup(value) {
    dispatch({
      type: 'SET_EXERCISE_MUSCLE_GROUP', logicalUnitKey, logicalTargetExerciseKey, muscleGroup: value,
    });
    setMuscleMenuOpen(false);
  }

  const showDropdown = editing && text.trim().length > 0;

  return (
    <View>
      {editing ? (
        <View style={styles.inlineInputRow}>
          <TextInput
            autoFocus
            onBlur={confirmTypedText}
            onChangeText={setText}
            onSubmitEditing={confirmTypedText}
            placeholder="Übung suchen oder eingeben …"
            placeholderTextColor="#6F6A77"
            returnKeyType="done"
            style={styles.inlineInput}
            value={text}
          />
          <Pressable accessibilityRole="button" onPress={clearRow} style={styles.inlineClearButton}>
            <Text style={styles.inlineClearButtonText}>✕</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable accessibilityRole="button" onPress={startEditing} style={styles.exercisePickButton}>
          <Text style={hasSelection ? styles.exercisePickButtonText : [styles.exercisePickButtonText, styles.exercisePickPlaceholder]}>
            {hasSelection ? exercise.exerciseName : 'Übung auswählen …'}
          </Text>
        </Pressable>
      )}

      {showDropdown ? (
        <View style={styles.inlineDropdown}>
          {results.length === 0 ? (
            <Text style={styles.inlineDropdownEmpty}>Keine Übungen gefunden — „Fertig" legt eine eigene Übung an.</Text>
          ) : results.map((item) => (
            <Pressable
              key={item.id}
              accessibilityRole="button"
              onPress={() => selectSuggestion(item)}
              onPressIn={() => { suggestionTapRef.current = true; }}
              onPressOut={() => { suggestionTapRef.current = false; }}
              style={styles.inlineDropdownItem}
            >
              <Text style={styles.inlineDropdownItemName}>{item.name}</Text>
              <View style={[
                styles.inlineDropdownBadge,
                item.scope === 'system' ? styles.inlineDropdownBadgeSystem : styles.inlineDropdownBadgeUser,
              ]}
              >
                <Text style={styles.inlineDropdownBadgeText}>
                  {item.scope === 'system' ? 'Grow' : 'Eigene Übung'}
                </Text>
              </View>
            </Pressable>
          ))}
        </View>
      ) : null}

      {!editing && hasSelection ? (
        <>
          <Pressable accessibilityRole="button" onPress={() => setMuscleMenuOpen((open) => !open)} style={styles.inlineMuscleRow}>
            <Text style={styles.inlineMuscleLabel}>Muskelgruppe</Text>
            <Text style={styles.inlineMuscleValue}>{uiMuscleGroupLabel(exercise.muscleGroup)} ▾</Text>
          </Pressable>
          {muscleMenuOpen ? (
            <View style={styles.inlineMuscleMenu}>
              {UI_MUSCLE_GROUPS.map((group) => (
                <Pressable
                  key={group.value}
                  accessibilityRole="button"
                  onPress={() => selectMuscleGroup(group.value)}
                  style={[styles.chip, exercise.muscleGroup === group.value && styles.chipActive]}
                >
                  <Text style={[styles.chipText, exercise.muscleGroup === group.value && styles.chipTextActive]}>
                    {group.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </>
      ) : null}
    </View>
  );
}
