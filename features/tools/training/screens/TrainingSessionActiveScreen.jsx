import { useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { COLORS } from '../../../../constants/colors';
import { s, sv } from '../../../../constants/layout';
import { supabase } from '../../../../services/supabaseClient';
import { useTrainingPlan } from '../hooks/useTrainingPlan';
import { createTrainingSession } from '../services/trainingSessionService';
import { styles } from '../styles/trainingStyles';

function parseDecimal(value) {
  const normalized = String(value || '').replace(',', '.').trim();
  if (!normalized) return null;

  const number = Number(normalized);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function parsePositiveInt(value) {
  const normalized = String(value || '').trim();
  if (!normalized) return null;

  const number = Number(normalized);
  return Number.isInteger(number) && number >= 0 ? number : null;
}

export default function TrainingSessionActiveScreen() {
  const { dayId } = useLocalSearchParams();
  const { plan, loading, error, loadPlan } = useTrainingPlan();

  const [exerciseValues, setExerciseValues] = useState({});
  const [sessionNote, setSessionNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  const selectedDay = useMemo(() => {
    if (!plan?.days) return null;
    return plan.days.find(day => String(day.id) === String(dayId));
  }, [plan, dayId]);

  const exercises = selectedDay?.exercises || [];

  const getExerciseValue = (exercise, field) => {
    const localValue = exerciseValues[exercise.id]?.[field];

    if (localValue !== undefined) return localValue;

    if (field === 'weight') return exercise.weight != null ? String(exercise.weight) : '';
    if (field === 'sets') return exercise.sets != null ? String(exercise.sets) : '';
    if (field === 'reps') return exercise.reps != null ? String(exercise.reps) : '';
    if (field === 'note') return exercise.note || '';

    return '';
  };

  const updateExerciseValue = (exerciseId, field, value) => {
    setExerciseValues(prev => ({
      ...prev,
      [exerciseId]: {
        ...prev[exerciseId],
        [field]: value,
      },
    }));
  };

  const handleSaveSession = async () => {
    if (!plan || !selectedDay || saving) return;

    setSaving(true);
    setSaveError(null);

    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();

      if (userError) throw userError;

      const userId = userData?.user?.id;

      if (!userId) {
        throw new Error('Kein eingeloggter Nutzer gefunden.');
      }

      const sessionExercises = exercises.map(exercise => ({
        exerciseId: exercise.id,
        name: exercise.name,
        weight: parseDecimal(getExerciseValue(exercise, 'weight')),
        sets: parsePositiveInt(getExerciseValue(exercise, 'sets')),
        reps: parsePositiveInt(getExerciseValue(exercise, 'reps')),
        note: getExerciseValue(exercise, 'note').trim(),
      }));

      await createTrainingSession({
        userId,
        planId: plan.id,
        dayId: selectedDay.id,
        note: sessionNote.trim(),
        exercises: sessionExercises,
      });

      Alert.alert(
        'Training gespeichert',
        'Deine Trainingseinheit wurde erfolgreich gespeichert.',
        [
          {
            text: 'OK',
            onPress: () => router.back(),
          },
        ]
      );
    } catch (e) {
      console.error('[Training Session] Save failed:', e);
      setSaveError('Trainingseinheit konnte nicht gespeichert werden.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={COLORS.gold} size="large" />
        <Text style={styles.loadingText}>Training wird geladen...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error}</Text>
        <Pressable onPress={loadPlan} style={styles.retryBtn}>
          <Text style={styles.retryText}>Erneut versuchen</Text>
        </Pressable>
      </View>
    );
  }

  if (!plan || !selectedDay) {
    return (
      <View style={styles.screen}>
        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="chevron-back" size={s(24)} color={COLORS.softGold} />
            <Text style={styles.backText}>Zurück</Text>
          </Pressable>
        </View>

        <View style={styles.centered}>
          <Text style={styles.emptyText}>Trainingstag nicht gefunden.</Text>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} style={styles.backButton} disabled={saving}>
          <Ionicons name="chevron-back" size={s(24)} color={COLORS.softGold} />
          <Text style={styles.backText}>Zurück</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <View style={styles.iconCircle}>
            <Ionicons name="play-outline" size={s(36)} color={COLORS.gold} />
          </View>
          <Text style={styles.title}>{selectedDay.name}</Text>
          <Text style={styles.subtitle}>Trage deine heutige Einheit ein</Text>
        </View>

        <Text style={styles.sectionLabel}>ÜBUNGEN</Text>

        {exercises.map((exercise, index) => (
          <View key={exercise.id} style={styles.sessionExerciseCard}>
            <View style={styles.sessionExerciseHeader}>
              <Text style={styles.sessionExerciseIndex}>{index + 1}</Text>
              <View style={styles.sessionExerciseTitleWrap}>
                <Text style={styles.sessionExerciseName}>{exercise.name}</Text>
                <Text style={styles.sessionExerciseHint}>
                  Planwert: {exercise.weight ?? '-'} kg · {exercise.sets ?? '-'} Sätze · {exercise.reps ?? '-'} Wdh.
                </Text>
              </View>
            </View>

            <View style={styles.sessionInputRow}>
              <View style={styles.sessionInputGroup}>
                <Text style={styles.sessionInputLabel}>kg</Text>
                <TextInput
                  style={styles.sessionSmallInput}
                  keyboardType="decimal-pad"
                  placeholder="-"
                  placeholderTextColor={COLORS.textFaint}
                  value={getExerciseValue(exercise, 'weight')}
                  onChangeText={value => updateExerciseValue(exercise.id, 'weight', value)}
                  editable={!saving}
                />
              </View>

              <View style={styles.sessionInputGroup}>
                <Text style={styles.sessionInputLabel}>Sätze</Text>
                <TextInput
                  style={styles.sessionSmallInput}
                  keyboardType="number-pad"
                  placeholder="-"
                  placeholderTextColor={COLORS.textFaint}
                  value={getExerciseValue(exercise, 'sets')}
                  onChangeText={value => updateExerciseValue(exercise.id, 'sets', value)}
                  editable={!saving}
                />
              </View>

              <View style={styles.sessionInputGroup}>
                <Text style={styles.sessionInputLabel}>Wdh.</Text>
                <TextInput
                  style={styles.sessionSmallInput}
                  keyboardType="number-pad"
                  placeholder="-"
                  placeholderTextColor={COLORS.textFaint}
                  value={getExerciseValue(exercise, 'reps')}
                  onChangeText={value => updateExerciseValue(exercise.id, 'reps', value)}
                  editable={!saving}
                />
              </View>
            </View>

            <TextInput
              style={styles.sessionNoteInput}
              placeholder="Notiz zur Übung, z.B. schwer, sauber, nächstes Mal +2,5 kg"
              placeholderTextColor={COLORS.textFaint}
              value={getExerciseValue(exercise, 'note')}
              onChangeText={value => updateExerciseValue(exercise.id, 'note', value)}
              editable={!saving}
              multiline
            />
          </View>
        ))}

        <Text style={[styles.sectionLabel, { marginTop: sv(18) }]}>
          NOTIZ ZUR EINHEIT
        </Text>

        <TextInput
          style={styles.sessionOverallNoteInput}
          placeholder="Optional: Wie lief das Training?"
          placeholderTextColor={COLORS.textFaint}
          value={sessionNote}
          onChangeText={setSessionNote}
          editable={!saving}
          multiline
        />

        {saveError ? (
          <Text style={styles.saveErrorText}>{saveError}</Text>
        ) : null}

        <Pressable
          style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
          onPress={handleSaveSession}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color={COLORS.black} />
          ) : (
            <Text style={styles.saveBtnText}>Training speichern</Text>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}