import { Pressable, Text, TextInput, View } from 'react-native';

import {
  TRAINING_V2_UNIT_TYPE_OPTIONS,
  unitTypeAllowsExercises,
} from '../models/trainingV2EditorModel';
import { styles } from '../styles/trainingV2Styles';
import { TrainingV2ExerciseEditorCard } from './TrainingV2ExerciseEditorCard';

const UNIT_TYPE_LABELS = {
  strength: 'Kraft',
  run: 'Laufen',
  rest: 'Erholung',
  mobility: 'Mobility',
  stretching: 'Dehnen',
};

export function TrainingV2UnitEditorCard({
  dispatch,
  unit,
  index,
  canMoveUp,
  canMoveDown,
}) {
  const logicalUnitKey = unit.logicalUnitKey;
  const allowsExercises = unitTypeAllowsExercises(unit.unitType);

  return (
    <View style={styles.editorUnitCard}>
      <View style={styles.editorUnitHeader}>
        <Text style={styles.editorUnitHeaderTitle}>Einheit {index + 1}</Text>
        <View style={styles.editorRowActions}>
          <Pressable
            accessibilityRole="button"
            disabled={!canMoveUp}
            onPress={() => dispatch({ type: 'MOVE_UNIT', logicalUnitKey, direction: 'up' })}
            style={styles.iconButton}
          >
            <Text style={styles.iconButtonText}>↑</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={!canMoveDown}
            onPress={() => dispatch({ type: 'MOVE_UNIT', logicalUnitKey, direction: 'down' })}
            style={styles.iconButton}
          >
            <Text style={styles.iconButtonText}>↓</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => dispatch({ type: 'REMOVE_UNIT', logicalUnitKey })}
            style={[styles.iconButton, styles.iconButtonDanger]}
          >
            <Text style={[styles.iconButtonText, styles.iconButtonDangerText]}>Entfernen</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.formLabel}>Name der Einheit</Text>
        <TextInput
          onChangeText={(text) => dispatch({ type: 'SET_UNIT_NAME', logicalUnitKey, name: text })}
          placeholder="z. B. Push Day"
          placeholderTextColor="#6F6A77"
          style={styles.formInput}
          value={unit.name}
        />
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.formLabel}>Art der Einheit</Text>
        <View style={styles.chipRow}>
          {TRAINING_V2_UNIT_TYPE_OPTIONS.map((unitType) => (
            <Pressable
              key={unitType}
              accessibilityRole="button"
              onPress={() => dispatch({ type: 'SET_UNIT_TYPE', logicalUnitKey, unitType })}
              style={[styles.chip, unit.unitType === unitType && styles.chipActive]}
            >
              <Text style={[styles.chipText, unit.unitType === unitType && styles.chipTextActive]}>
                {UNIT_TYPE_LABELS[unitType]}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {allowsExercises ? (
        <>
          {unit.exercises.map((exercise, exerciseIndex) => (
            <TrainingV2ExerciseEditorCard
              key={exercise.logicalTargetExerciseKey}
              canMoveDown={exerciseIndex < unit.exercises.length - 1}
              canMoveUp={exerciseIndex > 0}
              dispatch={dispatch}
              exercise={exercise}
              index={exerciseIndex}
              logicalUnitKey={logicalUnitKey}
            />
          ))}
          <Pressable
            accessibilityRole="button"
            onPress={() => dispatch({ type: 'ADD_EXERCISE', logicalUnitKey })}
            style={styles.addButton}
          >
            <Text style={styles.addButtonText}>+ Übung hinzufügen</Text>
          </Pressable>
        </>
      ) : (
        <Text style={styles.formHint}>
          Lauf- und Erholungseinheiten enthalten keine Übungen.
        </Text>
      )}
    </View>
  );
}
