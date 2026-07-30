import { Pressable, Text, TextInput, View } from 'react-native';

import { TRAINING_V2_SET_TYPE_OPTIONS } from '../models/trainingV2EditorModel';
import { styles } from '../styles/trainingV2Styles';

const SET_TYPE_LABELS = { warmup: 'Warm-up', work: 'Work', drop: 'Drop' };

function numberOrNull(text) {
  const trimmed = text.trim();
  if (trimmed.length === 0) return null;
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : null;
}

export function TrainingV2TargetSetEditorRow({
  dispatch,
  logicalUnitKey,
  logicalTargetExerciseKey,
  targetSet,
  index,
  canMoveUp,
  canMoveDown,
}) {
  const setField = (field, value) => dispatch({
    type: 'SET_TARGET_SET_FIELD',
    logicalUnitKey,
    logicalTargetExerciseKey,
    logicalTargetSetKey: targetSet.logicalTargetSetKey,
    field,
    value,
  });

  return (
    <View style={styles.targetSetRow}>
      <Text style={styles.targetSetLabel}>Satz {index + 1}</Text>

      <View style={styles.chipRow}>
        {TRAINING_V2_SET_TYPE_OPTIONS.map((setType) => (
          <Pressable
            key={setType}
            accessibilityRole="button"
            onPress={() => setField('setType', setType)}
            style={[styles.chip, targetSet.setType === setType && styles.chipActive]}
          >
            <Text style={[styles.chipText, targetSet.setType === setType && styles.chipTextActive]}>
              {SET_TYPE_LABELS[setType]}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.targetSetFieldGroup}>
        <Text style={styles.targetSetFieldLabel}>kg</Text>
        <TextInput
          accessibilityLabel="Gewicht in kg"
          keyboardType="decimal-pad"
          onChangeText={(text) => setField('targetWeightKg', numberOrNull(text))}
          placeholder="kg"
          placeholderTextColor="#6F6A77"
          style={styles.targetSetInput}
          value={targetSet.targetWeightKg === null ? '' : String(targetSet.targetWeightKg)}
        />
      </View>
      <View style={styles.targetSetFieldGroup}>
        <Text style={styles.targetSetFieldLabel}>Wiederholungen</Text>
        <TextInput
          accessibilityLabel="Wiederholungen"
          keyboardType="number-pad"
          onChangeText={(text) => {
            // Contract requires a {minimum, maximum} range even though only a single
            // reps number is shown — a single visible field maps to both ends of the
            // range, so the API/DB model does not need to change for this.
            const value = numberOrNull(text);
            setField('targetReps', value === null ? null : { minimum: value, maximum: value });
          }}
          placeholder="z. B. 10"
          placeholderTextColor="#6F6A77"
          style={styles.targetSetInput}
          value={targetSet.targetReps === null ? '' : String(targetSet.targetReps.minimum)}
        />
      </View>

      <View style={styles.editorRowActions}>
        <Pressable
          accessibilityRole="button"
          disabled={!canMoveUp}
          onPress={() => dispatch({
            type: 'MOVE_TARGET_SET', logicalUnitKey, logicalTargetExerciseKey,
            logicalTargetSetKey: targetSet.logicalTargetSetKey, direction: 'up',
          })}
          style={styles.iconButton}
        >
          <Text style={styles.iconButtonText}>↑</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          disabled={!canMoveDown}
          onPress={() => dispatch({
            type: 'MOVE_TARGET_SET', logicalUnitKey, logicalTargetExerciseKey,
            logicalTargetSetKey: targetSet.logicalTargetSetKey, direction: 'down',
          })}
          style={styles.iconButton}
        >
          <Text style={styles.iconButtonText}>↓</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => dispatch({
            type: 'REMOVE_TARGET_SET', logicalUnitKey, logicalTargetExerciseKey,
            logicalTargetSetKey: targetSet.logicalTargetSetKey,
          })}
          style={[styles.iconButton, styles.iconButtonDanger]}
        >
          <Text style={[styles.iconButtonText, styles.iconButtonDangerText]}>Entfernen</Text>
        </Pressable>
      </View>
    </View>
  );
}
