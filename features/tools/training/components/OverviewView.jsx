import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { COLORS } from '../../../../constants/colors';
import { s, sf, sv } from '../../../../constants/layout';
import { styles } from '../styles/trainingStyles';
import { TrainingDayCard } from './TrainingDayCard';
import { EditExerciseModal } from './EditExerciseModal';
import { AddExerciseModal } from './AddExerciseModal';
import { AddDayModal } from './AddDayModal';

export function OverviewView({
  plan,
  onAddExercise,
  onUpdateExercise,
  onDeleteExercise,
  onDeletePlan,
  onRenameDay,
  onAddDay,
}) {
  const [editingExercise, setEditingExercise] = useState(null);
  const [addingToDayId, setAddingToDayId] = useState(null);
  const [addingDay, setAddingDay] = useState(false);

  const handleDeletePlan = () => {
    Alert.alert(
      'Plan löschen',
      `Möchtest du „${plan.name}" wirklich löschen? Alle Trainingstage und Übungen werden entfernt.`,
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Löschen',
          style: 'destructive',
          onPress: async () => {
            try {
              await onDeletePlan();
            } catch {
              Alert.alert('Fehler', 'Plan konnte nicht gelöscht werden.');
            }
          },
        },
      ]
    );
  };

  const handleSaveExercise = async (data) => {
    await onUpdateExercise(editingExercise.id, data);
    setEditingExercise(null);
  };

  const handleDeleteExercise = async () => {
    await onDeleteExercise(editingExercise.id);
    setEditingExercise(null);
  };

  const handleAddExercise = async (data) => {
    await onAddExercise(addingToDayId, data);
    setAddingToDayId(null);
  };

  return (
    <View style={styles.screen}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={s(24)} color={COLORS.softGold} />
          <Text style={styles.backText}>Tools</Text>
        </Pressable>
        <Pressable onPress={handleDeletePlan} style={styles.deletePlanBtn} hitSlop={s(8)}>
          <Ionicons name="trash-outline" size={s(20)} color={COLORS.error} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <View style={styles.iconCircle}>
            <Ionicons name="barbell-outline" size={s(36)} color={COLORS.gold} />
          </View>
          <Text style={styles.title}>{plan.name.toUpperCase()}</Text>
          <Text style={styles.subtitle}>
            {plan.days.length} {plan.days.length === 1 ? 'Trainingstag' : 'Trainingstage'}
          </Text>
        </View>

        {plan.days.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="barbell-outline" size={s(40)} color={COLORS.textDim} />
            <Text style={styles.emptyText}>Keine Trainingstage vorhanden.</Text>
          </View>
        ) : (
          <View style={styles.daysList}>
            {plan.days.map(day => (
              <TrainingDayCard
                key={day.id}
                day={day}
                onExercisePress={setEditingExercise}
                onAddExercise={() => setAddingToDayId(day.id)}
                onRenameDay={onRenameDay}
              />
            ))}
          </View>
        )}

        <Pressable
          style={styles.addDayBtn}
          onPress={() => setAddingDay(true)}
        >
          <Ionicons name="add-circle-outline" size={s(20)} color={COLORS.gold} />
          <Text style={styles.addDayBtnText}>Tag hinzufügen</Text>
        </Pressable>
      </ScrollView>

      <EditExerciseModal
        visible={editingExercise !== null}
        exercise={editingExercise}
        onClose={() => setEditingExercise(null)}
        onSave={handleSaveExercise}
        onDelete={handleDeleteExercise}
      />

      <AddExerciseModal
        visible={addingToDayId !== null}
        onClose={() => setAddingToDayId(null)}
        onSave={handleAddExercise}
      />

      <AddDayModal
        visible={addingDay}
        onClose={() => setAddingDay(false)}
        onSave={async (name) => {
          await onAddDay(name);
          setAddingDay(false);
        }}
      />
    </View>
  );
}
