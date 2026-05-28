import { useState } from 'react';
import { View, Text, Pressable, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { COLORS } from '../../../../constants/colors';
import { s, sv } from '../../../../constants/layout';
import { styles } from '../styles/trainingStyles';
import { formatWeight, formatSetsReps } from '../utils/trainingUtils';

const softPress = (baseStyle) => ({ pressed }) => [
  baseStyle,
  pressed && { opacity: 0.92, transform: [{ scale: 0.985 }] },
];

const iconPress = ({ pressed }) => [
  pressed && { opacity: 0.75, transform: [{ scale: 0.94 }] },
];

function getDayType(day) {
  if (day?.type === 'run' || day?.day_type === 'run') return 'run';
  if (day?.type === 'rest' || day?.day_type === 'rest') return 'rest';
  return 'gym';
}

export function TrainingDayCard({ day, onExercisePress, onAddExercise, onRenameDay }) {
  const exercises = Array.isArray(day?.exercises) ? day.exercises : [];
  const dayType = getDayType(day);
  const isRunDay = dayType === 'run';
  const isRestDay = dayType === 'rest';
  const isGymDay = dayType === 'gym';
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
          <Pressable onPress={handleConfirmRename} style={iconPress} hitSlop={s(10)}>
            <Ionicons name="checkmark-circle" size={s(22)} color={COLORS.gold} />
          </Pressable>
        </View>
      ) : (
        <View style={styles.dayCardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.dayCardTitle}>{day.name}</Text>
            {isRunDay ? (
              <Text style={[styles.dayCardCount, { marginTop: sv(4) }]}>Lauftag</Text>
            ) : null}
            {isRestDay ? (
              <Text style={[styles.dayCardCount, { marginTop: sv(4) }]}>Rest Day</Text>
            ) : null}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(10) }}>
            <Pressable onPress={() => setIsRenaming(true)} style={iconPress} hitSlop={s(10)}>
              <Ionicons name="pencil-outline" size={s(16)} color={COLORS.textDim} />
            </Pressable>
            {isGymDay ? (
              <Text style={styles.dayCardCount}>
                {exercises.length} {exercises.length === 1 ? 'Übung' : 'Übungen'}
              </Text>
            ) : (
              <Ionicons name={isRunDay ? 'walk-outline' : 'moon-outline'} size={s(17)} color={COLORS.gold} />
            )}
          </View>
        </View>
      )}

      {!isGymDay ? (
        <Text style={styles.dayCardEmpty}>
          {isRunDay
            ? 'Lauftag: Distanz und Dauer trägst du ein, wenn du die Einheit speicherst.'
            : 'Rest Day: Dieser Tag dient nur zur Planung und wird nicht als Einheit gespeichert.'}
        </Text>
      ) : exercises.length === 0 ? (
        <Text style={styles.dayCardEmpty}>
          Keine Kraftübungen hinterlegt.
        </Text>
      ) : (
        <View style={styles.exerciseList}>
          {exercises.map(exercise => (
            <Pressable
              key={exercise.id}
              style={softPress(styles.exerciseItem)}
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

      {isGymDay ? (
        <Pressable style={softPress(styles.addExerciseToDayBtn)} onPress={onAddExercise}>
          <Ionicons name="add-outline" size={s(16)} color={COLORS.softGold} />
          <Text style={styles.addExerciseToDayBtnText}>Übung hinzufügen</Text>
        </Pressable>
      ) : null}
    </View>
  );
}