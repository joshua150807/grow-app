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

function numberOrZero(text) {
  const value = Number(text.trim());
  return Number.isFinite(value) && value >= 0 ? value : 0;
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

      <TextInput
        accessibilityLabel="Gewicht in kg"
        keyboardType="numeric"
        onChangeText={(text) => setField('targetWeightKg', numberOrNull(text))}
        placeholder="kg"
        placeholderTextColor="#6F6A77"
        style={styles.targetSetInput}
        value={targetSet.targetWeightKg === null ? '' : String(targetSet.targetWeightKg)}
      />
      <TextInput
        accessibilityLabel="Minimale Wiederholungen"
        keyboardType="numeric"
        onChangeText={(text) => setField('targetReps', {
          minimum: numberOrNull(text) ?? 0,
          maximum: targetSet.targetReps?.maximum ?? (numberOrNull(text) ?? 0),
        })}
        placeholder="Wdh. min"
        placeholderTextColor="#6F6A77"
        style={styles.targetSetInput}
        value={targetSet.targetReps === null ? '' : String(targetSet.targetReps.minimum)}
      />
      <TextInput
        accessibilityLabel="Maximale Wiederholungen"
        keyboardType="numeric"
        onChangeText={(text) => setField('targetReps', {
          minimum: targetSet.targetReps?.minimum ?? (numberOrNull(text) ?? 0),
          maximum: numberOrNull(text) ?? 0,
        })}
        placeholder="Wdh. max"
        placeholderTextColor="#6F6A77"
        style={styles.targetSetInput}
        value={targetSet.targetReps === null ? '' : String(targetSet.targetReps.maximum)}
      />
      <TextInput
        accessibilityLabel="RIR"
        keyboardType="numeric"
        onChangeText={(text) => setField('targetRir', numberOrNull(text))}
        placeholder="RIR"
        placeholderTextColor="#6F6A77"
        style={styles.targetSetInput}
        value={targetSet.targetRir === null ? '' : String(targetSet.targetRir)}
      />
      <TextInput
        accessibilityLabel="Pause in Sekunden"
        keyboardType="numeric"
        onChangeText={(text) => setField('plannedRestSeconds', numberOrZero(text))}
        placeholder="Pause (s)"
        placeholderTextColor="#6F6A77"
        style={styles.targetSetInput}
        value={String(targetSet.plannedRestSeconds)}
      />

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
