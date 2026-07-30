import { Pressable, Text, TextInput, View } from 'react-native';

import { styles } from '../styles/trainingV2Styles';
import { TrainingV2InlineExercisePicker } from './TrainingV2InlineExercisePicker';
import { TrainingV2TargetSetEditorRow } from './TrainingV2TargetSetEditorRow';

export function TrainingV2ExerciseEditorCard({
  dispatch,
  logicalUnitKey,
  exercise,
  index,
  canMoveUp,
  canMoveDown,
}) {
  const logicalTargetExerciseKey = exercise.logicalTargetExerciseKey;

  return (
    <View style={styles.exerciseEditorCard}>
      <View style={styles.editorUnitHeader}>
        <Text style={styles.editorUnitHeaderTitle}>Übung {index + 1}</Text>
        <View style={styles.editorRowActions}>
          <Pressable
            accessibilityRole="button"
            disabled={!canMoveUp}
            onPress={() => dispatch({ type: 'MOVE_EXERCISE', logicalUnitKey, logicalTargetExerciseKey, direction: 'up' })}
            style={styles.iconButton}
          >
            <Text style={styles.iconButtonText}>↑</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={!canMoveDown}
            onPress={() => dispatch({ type: 'MOVE_EXERCISE', logicalUnitKey, logicalTargetExerciseKey, direction: 'down' })}
            style={styles.iconButton}
          >
            <Text style={styles.iconButtonText}>↓</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => dispatch({ type: 'REMOVE_EXERCISE', logicalUnitKey, logicalTargetExerciseKey })}
            style={[styles.iconButton, styles.iconButtonDanger]}
          >
            <Text style={[styles.iconButtonText, styles.iconButtonDangerText]}>Entfernen</Text>
          </Pressable>
        </View>
      </View>

      <TrainingV2InlineExercisePicker
        dispatch={dispatch}
        exercise={exercise}
        logicalTargetExerciseKey={logicalTargetExerciseKey}
        logicalUnitKey={logicalUnitKey}
      />

      <TextInput
        multiline
        onChangeText={(text) => dispatch({
          type: 'SET_EXERCISE_NOTE', logicalUnitKey, logicalTargetExerciseKey, note: text,
        })}
        placeholder="Notiz (optional)"
        placeholderTextColor="#6F6A77"
        style={[styles.formInput, styles.formInputMultiline, { marginTop: 8 }]}
        value={exercise.note}
      />

      {exercise.targetSets.map((targetSet, setIndex) => (
        <TrainingV2TargetSetEditorRow
          key={targetSet.logicalTargetSetKey}
          canMoveDown={setIndex < exercise.targetSets.length - 1}
          canMoveUp={setIndex > 0}
          dispatch={dispatch}
          index={setIndex}
          logicalTargetExerciseKey={logicalTargetExerciseKey}
          logicalUnitKey={logicalUnitKey}
          targetSet={targetSet}
        />
      ))}

      <Pressable
        accessibilityRole="button"
        onPress={() => dispatch({ type: 'ADD_TARGET_SET', logicalUnitKey, logicalTargetExerciseKey })}
        style={styles.addButton}
      >
        <Text style={styles.addButtonText}>+ Satz hinzufügen</Text>
      </Pressable>
    </View>
  );
}
