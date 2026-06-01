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
import { triggerHaptic } from '../../../../lib/haptics';
import { useDelayedLoading } from '../../../../hooks/useDelayedLoading';

const softPress = (baseStyle, disabled = false) => ({ pressed }) => [
  baseStyle,
  pressed && !disabled && { opacity: 0.9, transform: [{ scale: 0.985 }] },
];

function safeText(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function parseDecimal(value) {
  const normalized = safeText(value).replace(',', '.');
  if (!normalized) return null;

  const number = Number(normalized);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function parsePositiveDecimal(value) {
  const number = parseDecimal(value);
  return number !== null && number > 0 ? number : null;
}

function parsePositiveInt(value) {
  const normalized = safeText(value);
  if (!normalized) return null;

  const number = Number(normalized);
  return Number.isInteger(number) && number > 0 ? number : null;
}

export default function TrainingSessionActiveScreen() {
  const { dayId } = useLocalSearchParams();
  const { plan, loading, error, loadPlan } = useTrainingPlan();
  const showLoading = useDelayedLoading(loading);

  const [exerciseValues, setExerciseValues] = useState({});
  const [sessionNote, setSessionNote] = useState('');
  const [runDurationMinutes, setRunDurationMinutes] = useState('');
  const [runDistanceKm, setRunDistanceKm] = useState('');
  const [runPace, setRunPace] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  const selectedDay = useMemo(() => {
    if (!plan?.days) return null;
    return plan.days.find(day => String(day.id) === String(dayId));
  }, [plan, dayId]);

  const exercises = selectedDay?.exercises || [];
  const dayType = selectedDay?.type === 'run' || selectedDay?.day_type === 'run'
    ? 'run'
    : selectedDay?.type === 'rest' || selectedDay?.day_type === 'rest'
      ? 'rest'
      : 'gym';
  const isRunDay = dayType === 'run';
  const isRestDay = dayType === 'rest';

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
    if (!plan || !selectedDay || saving || isRestDay) return;

    void triggerHaptic('medium');

    setSaving(true);
    setSaveError(null);

    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();

      if (userError) throw userError;

      const userId = userData?.user?.id;

      if (!userId) {
        throw new Error('Kein eingeloggter Nutzer gefunden.');
      }

      const durationMinutes = isRunDay ? parsePositiveInt(runDurationMinutes) : null;
      const distanceKm = isRunDay ? parsePositiveDecimal(runDistanceKm) : null;

      if (isRunDay && durationMinutes === null && distanceKm === null) {
        setSaveError('Trage für die Laufeinheit mindestens Dauer oder Distanz ein.');
        return;
      }

      const sessionExercises = isRunDay
        ? []
        : exercises.map(exercise => ({
            exerciseId: exercise.id,
            name: exercise.name,
            weight: parseDecimal(getExerciseValue(exercise, 'weight')),
            sets: parsePositiveInt(getExerciseValue(exercise, 'sets')),
            reps: parsePositiveInt(getExerciseValue(exercise, 'reps')),
            note: getExerciseValue(exercise, 'note').trim(),
          }));

      if (!isRunDay) {
        if (sessionExercises.length === 0) {
          setSaveError('Dieser Trainingstag hat keine Übungen. Füge im Plan-Editor zuerst eine Übung hinzu.');
          return;
        }

        const invalidExercise = sessionExercises.find(exercise => exercise.sets === null || exercise.reps === null);

        if (invalidExercise) {
          setSaveError(`Prüfe "${invalidExercise.name}": Sätze und Wiederholungen müssen größer 0 sein.`);
          return;
        }
      }

      await createTrainingSession({
        userId,
        planId: plan.id,
        dayId: selectedDay.id,
        sessionType: isRunDay ? 'run' : 'gym',
        note: sessionNote.trim(),
        exercises: sessionExercises,
        runDurationMinutes: durationMinutes,
        runDistanceKm: distanceKm,
        runPace: safeText(runPace) || null,
      });

      Alert.alert(
        isRunDay ? 'Lauf gespeichert' : 'Training gespeichert',
        isRunDay
          ? 'Deine Laufeinheit wurde erfolgreich gespeichert.'
          : 'Deine Trainingseinheit wurde erfolgreich gespeichert.',
        [
          {
            text: 'OK',
            onPress: () => router.back(),
          },
        ]
      );
    } catch (e) {
      console.error('[Training Session] Save failed:', e);
      setSaveError(e?.message || 'Trainingseinheit konnte nicht gespeichert werden.');
    } finally {
      setSaving(false);
    }
  };

  if (showLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={COLORS.gold} size="large" />
        <Text style={styles.loadingText}>Training wird geladen...</Text>
      </View>
    );
  }

  if (loading) {
    return <View style={styles.screen} />;
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error}</Text>
        <Pressable onPress={loadPlan} style={softPress(styles.retryBtn)}>
          <Text style={styles.retryText}>Erneut versuchen</Text>
        </Pressable>
      </View>
    );
  }

  if (!plan || !selectedDay) {
    return (
      <View style={styles.screen}>
        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()} style={softPress(styles.backButton)} hitSlop={s(8)}>
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

  if (isRestDay) {
    return (
      <View style={styles.screen}>
        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()} style={softPress(styles.backButton)} hitSlop={s(8)}>
            <Ionicons name="chevron-back" size={s(24)} color={COLORS.softGold} />
            <Text style={styles.backText}>Zurück</Text>
          </Pressable>
        </View>

        <View style={styles.centered}>
          <Ionicons name="moon-outline" size={s(42)} color={COLORS.gold} />
          <Text style={[styles.emptyText, { marginTop: sv(12) }]}>Das ist ein Rest Day.</Text>
          <Text style={[styles.loadingText, { textAlign: 'center', marginTop: sv(6) }]}>Ruhetage werden im Plan angezeigt, aber nicht als Training gespeichert.</Text>
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
        <Pressable onPress={() => router.back()} style={softPress(styles.backButton, saving)} hitSlop={s(8)} disabled={saving}>
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
            <Ionicons name={isRunDay ? 'walk-outline' : 'play-outline'} size={s(36)} color={COLORS.gold} />
          </View>
          <Text style={styles.title}>{selectedDay.name}</Text>
          <Text style={styles.subtitle}>
            {isRunDay ? 'Speichere deine Laufeinheit' : 'Trage deine heutige Einheit ein'}
          </Text>
        </View>

        <Text style={styles.sectionLabel}>{isRunDay ? 'LAUFEINHEIT' : 'ÜBUNGEN'}</Text>

        {isRunDay ? (
          <View style={styles.sessionExerciseCard}>
            <View style={styles.sessionExerciseHeader}>
              <Text style={styles.sessionExerciseIndex}>🏃</Text>
              <View style={styles.sessionExerciseTitleWrap}>
                <Text style={styles.sessionExerciseName}>{selectedDay.name}</Text>
                <Text style={styles.sessionExerciseHint}>
                  Trage Dauer und/oder Distanz ein. Pace ist optional.
                </Text>
              </View>
            </View>

            <View style={styles.sessionInputRow}>
              <View style={styles.sessionInputGroup}>
                <Text style={styles.sessionInputLabel}>Min.</Text>
                <TextInput
                  style={styles.sessionSmallInput}
                  keyboardType="number-pad"
                  placeholder="45"
                  placeholderTextColor={COLORS.textFaint}
                  value={runDurationMinutes}
                  onChangeText={setRunDurationMinutes}
                  editable={!saving}
                />
              </View>

              <View style={styles.sessionInputGroup}>
                <Text style={styles.sessionInputLabel}>km</Text>
                <TextInput
                  style={styles.sessionSmallInput}
                  keyboardType="decimal-pad"
                  placeholder="6,0"
                  placeholderTextColor={COLORS.textFaint}
                  value={runDistanceKm}
                  onChangeText={setRunDistanceKm}
                  editable={!saving}
                />
              </View>

              <View style={styles.sessionInputGroup}>
                <Text style={styles.sessionInputLabel}>Pace</Text>
                <TextInput
                  style={styles.sessionSmallInput}
                  placeholder="6:30"
                  placeholderTextColor={COLORS.textFaint}
                  value={runPace}
                  onChangeText={setRunPace}
                  editable={!saving}
                />
              </View>
            </View>
          </View>
        ) : null}

        {!isRunDay && exercises.length === 0 ? (
          <View style={styles.sessionExerciseCard}>
            <View style={styles.sessionExerciseHeader}>
              <Text style={styles.sessionExerciseIndex}>!</Text>
              <View style={styles.sessionExerciseTitleWrap}>
                <Text style={styles.sessionExerciseName}>Keine Übungen vorhanden</Text>
                <Text style={styles.sessionExerciseHint}>
                  Öffne den Plan-Editor und füge diesem Tag zuerst eine Übung hinzu.
                </Text>
              </View>
            </View>
          </View>
        ) : null}

        {!isRunDay && exercises.map((exercise, index) => (
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

        <Text style={[styles.sectionLabel, { marginTop: sv(18) }]}>NOTIZ ZUR EINHEIT</Text>

        <TextInput
          style={styles.sessionOverallNoteInput}
          placeholder={isRunDay ? 'Optional: Gefühl, Puls, Untergrund, Zone...' : 'Optional: Wie lief das Training?'}
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
          style={softPress([styles.saveBtn, (saving || (!isRunDay && exercises.length === 0)) && styles.saveBtnDisabled], saving || (!isRunDay && exercises.length === 0))}
          onPress={handleSaveSession}
          disabled={saving || (!isRunDay && exercises.length === 0)}
        >
          {saving ? (
            <ActivityIndicator color={COLORS.black} />
          ) : (
            <Text style={styles.saveBtnText}>{isRunDay ? 'Lauf speichern' : 'Training speichern'}</Text>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}