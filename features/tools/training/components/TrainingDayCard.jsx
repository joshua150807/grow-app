import { useState } from 'react';
import { View, Text, Pressable, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { COLORS } from '../../../../constants/colors';
import { s, sv } from '../../../../constants/layout';
import { styles } from '../styles/trainingStyles';
import { formatWeight, formatSetsReps } from '../utils/trainingUtils';

export function TrainingDayCard({ day, onExercisePress, onAddExercise, onRenameDay }) {
  const [isRenaming, setIsRenaming] = useState(false);
  const [draftName, setDraftName] = useState(day.name);

  const handleConfirmRename = async () => {
    const trimmed = draftName.trim();
    if (!trimmed || trimmed === day.name) {
      setIsRenaming(false);
      setDraftName(day.name);
      return;
    }
    setIsRenaming(false);
    try {
      await onRenameDay(day.id, trimmed);
    } catch {
      setDraftName(day.name);
    }
  };

  return (
    <View style={styles.dayCard}>
      {isRenaming ? (
        <View style={styles.dayCardRenameRow}>
          <TextInput
            style={styles.dayCardRenameInput}
            value={draftName}
            onChangeText={setDraftName}
            autoFocus
            onBlur={handleConfirmRename}
            returnKeyType="done"
            onSubmitEditing={handleConfirmRename}
          />
          <Pressable onPress={handleConfirmRename} hitSlop={s(8)}>
            <Ionicons name="checkmark-circle" size={s(22)} color={COLORS.gold} />
          </Pressable>
        </View>
      ) : (
        <View style={styles.dayCardHeader}>
          <Text style={styles.dayCardTitle}>{day.name}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(10) }}>
            <Pressable onPress={() => setIsRenaming(true)} hitSlop={s(8)}>
              <Ionicons name="pencil-outline" size={s(16)} color={COLORS.textDim} />
            </Pressable>
            <Text style={styles.dayCardCount}>
              {day.exercises.length} {day.exercises.length === 1 ? 'Übung' : 'Übungen'}
            </Text>
          </View>
        </View>
      )}

      {day.exercises.length === 0 ? (
        <Text style={styles.dayCardEmpty}>Noch keine Übungen.</Text>
      ) : (
        <View style={styles.exerciseList}>
          {day.exercises.map(exercise => (
            <Pressable
              key={exercise.id}
              style={styles.exerciseItem}
              onPress={() => onExercisePress(exercise)}
            >
              <View style={styles.exerciseItemMain}>
                <Text style={styles.exerciseItemName}>{exercise.name}</Text>
                <View style={styles.exerciseItemDetails}>
                  <Text style={styles.exerciseItemWeight}>
                    {formatWeight(exercise.weight)}
                  </Text>
                  <Text style={styles.exerciseItemSetsReps}>
                    {formatSetsReps(exercise.sets, exercise.reps)}
                  </Text>
                </View>
                {exercise.note ? (
                  <Text style={styles.exerciseItemNote}>{exercise.note}</Text>
                ) : null}
              </View>
              <Ionicons name="create-outline" size={s(17)} color={COLORS.textDim} />
            </Pressable>
          ))}
        </View>
      )}

      <Pressable style={styles.addExerciseToDayBtn} onPress={onAddExercise}>
        <Ionicons name="add-outline" size={s(16)} color={COLORS.softGold} />
        <Text style={styles.addExerciseToDayBtnText}>Übung hinzufügen</Text>
      </Pressable>
    </View>
  );
}
