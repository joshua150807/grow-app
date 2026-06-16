import { useEffect, useMemo, useState } from 'react';
import {
  View, Text, ScrollView, Pressable, TextInput, ActivityIndicator, Alert,
  KeyboardAvoidingView, Platform,
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
import { buildMuscleGroupSections, resolveMuscleGroup } from '../utils/muscleGroupUtils';

const PAUSE_SECONDS = 180;
const softPress = (baseStyle, disabled = false) => ({ pressed }) => [
  baseStyle,
  pressed && !disabled && { opacity: 0.9, transform: [{ scale: 0.985 }] },
];
const safeText = value => value == null ? '' : String(value).trim();
const parseDecimal = value => {
  const text = safeText(value).replace(',', '.');
  if (!text) return null;
  const number = Number(text);
  return Number.isFinite(number) && number >= 0 ? number : null;
};
const parsePositiveDecimal = value => {
  const number = parseDecimal(value);
  return number !== null && number > 0 ? number : null;
};
const parsePositiveInt = value => {
  const number = Number(safeText(value));
  return Number.isInteger(number) && number > 0 ? number : null;
};
const formatTimer = seconds => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

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
  const [sectionIndex, setSectionIndex] = useState(0);
  const [pauseSeconds, setPauseSeconds] = useState(PAUSE_SECONDS);
  const [pauseTargetIndex, setPauseTargetIndex] = useState(null);

  const selectedDay = useMemo(() => plan?.days?.find(day => String(day.id) === String(dayId)) || null, [plan, dayId]);
  const exercises = selectedDay?.exercises || [];
  const sections = useMemo(() => buildMuscleGroupSections(exercises), [exercises]);
  const currentSection = sections[sectionIndex] || null;
  const dayType = selectedDay?.type === 'run' || selectedDay?.day_type === 'run' ? 'run'
    : selectedDay?.type === 'rest' || selectedDay?.day_type === 'rest' ? 'rest' : 'gym';
  const isRunDay = dayType === 'run';
  const isRestDay = dayType === 'rest';
  const isPausing = pauseTargetIndex !== null;

  useEffect(() => {
    if (!isPausing) return undefined;
    if (pauseSeconds <= 0) {
      setSectionIndex(pauseTargetIndex);
      setPauseTargetIndex(null);
      setPauseSeconds(PAUSE_SECONDS);
      return undefined;
    }
    const timer = setInterval(() => setPauseSeconds(value => Math.max(0, value - 1)), 1000);
    return () => clearInterval(timer);
  }, [isPausing, pauseSeconds, pauseTargetIndex]);

  const getExerciseValue = (exercise, field) => {
    const local = exerciseValues[exercise.id]?.[field];
    if (local !== undefined) return local;
    if (field === 'weight') return exercise.weight != null ? String(exercise.weight) : '';
    if (field === 'sets') return exercise.sets != null ? String(exercise.sets) : '';
    if (field === 'reps') return exercise.reps != null ? String(exercise.reps) : '';
    if (field === 'note') return exercise.note || '';
    return '';
  };
  const updateExerciseValue = (id, field, value) => setExerciseValues(prev => ({
    ...prev, [id]: { ...prev[id], [field]: value },
  }));
  const skipPause = () => {
    if (pauseTargetIndex === null) return;
    setSectionIndex(pauseTargetIndex);
    setPauseTargetIndex(null);
    setPauseSeconds(PAUSE_SECONDS);
  };
  const startSectionPause = () => {
    if (sectionIndex >= sections.length - 1) return;
    setPauseSeconds(PAUSE_SECONDS);
    setPauseTargetIndex(sectionIndex + 1);
  };

  const saveSession = async () => {
    if (!plan || !selectedDay || saving || isRestDay) return;
    setSaving(true);
    setSaveError(null);
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      const userId = userData?.user?.id;
      if (!userId) throw new Error('Kein eingeloggter Nutzer gefunden.');
      const durationMinutes = isRunDay ? parsePositiveInt(runDurationMinutes) : null;
      const distanceKm = isRunDay ? parsePositiveDecimal(runDistanceKm) : null;
      if (isRunDay && durationMinutes === null && distanceKm === null) {
        setSaveError('Trage für die Laufeinheit mindestens Dauer oder Distanz ein.');
        return;
      }
      const sessionExercises = isRunDay ? [] : exercises.map(exercise => ({
        exerciseId: exercise.id,
        name: exercise.name,
        muscleGroup: resolveMuscleGroup(exercise.muscle_group, exercise.name),
        weight: parseDecimal(getExerciseValue(exercise, 'weight')),
        sets: parsePositiveInt(getExerciseValue(exercise, 'sets')),
        reps: parsePositiveInt(getExerciseValue(exercise, 'reps')),
        note: getExerciseValue(exercise, 'note').trim(),
      }));
      const invalid = sessionExercises.find(exercise => exercise.sets === null || exercise.reps === null);
      if (!isRunDay && invalid) {
        setSaveError(`Prüfe "${invalid.name}": Sätze und Wiederholungen müssen größer 0 sein.`);
        return;
      }
      await createTrainingSession({
        userId, planId: plan.id, dayId: selectedDay.id, sessionType: isRunDay ? 'run' : 'gym',
        note: sessionNote.trim(), exercises: sessionExercises,
        runDurationMinutes: durationMinutes, runDistanceKm: distanceKm, runPace: safeText(runPace) || null,
      });
      Alert.alert(isRunDay ? 'Lauf gespeichert' : 'Training gespeichert',
        isRunDay ? 'Deine Laufeinheit wurde erfolgreich gespeichert.' : 'Dein Training wurde vollständig gespeichert.',
        [{ text: 'OK', onPress: () => router.back() }]);
    } catch (e) {
      console.error('[Training Session] Save failed:', e);
      Alert.alert('Speichern fehlgeschlagen', e?.message || 'Trainingseinheit konnte nicht gespeichert werden.');
      setSaveError(e?.message || 'Trainingseinheit konnte nicht gespeichert werden.');
    } finally { setSaving(false); }
  };

  const confirmFinish = () => {
    void triggerHaptic('medium');
    Alert.alert('Training beenden?', 'Dein Training wird anschließend gespeichert.', [
      { text: 'Abbrechen', style: 'cancel' },
      { text: 'Beenden und speichern', onPress: saveSession },
    ]);
  };

  if (showLoading) return <View style={styles.centered}><ActivityIndicator color={COLORS.gold} size="large" /><Text style={styles.loadingText}>Training wird geladen...</Text></View>;
  if (loading) return <View style={styles.screen} />;
  if (error) return <View style={styles.centered}><Text style={styles.errorText}>{error}</Text><Pressable onPress={loadPlan} style={softPress(styles.retryBtn)}><Text style={styles.retryText}>Erneut versuchen</Text></Pressable></View>;
  if (!plan || !selectedDay) return <View style={styles.centered}><Text style={styles.emptyText}>Trainingstag nicht gefunden.</Text></View>;
  if (isRestDay) return <View style={styles.centered}><Ionicons name="moon-outline" size={s(42)} color={COLORS.gold} /><Text style={[styles.emptyText, { marginTop: sv(12) }]}>Das ist ein Rest Day.</Text></View>;

  if (isPausing) {
    return (
      <Pressable style={styles.pauseScreen} onPress={skipPause}>
        <Text style={styles.pauseTitle}>Satzpause</Text>
        <Text style={styles.pauseTimer}>{formatTimer(pauseSeconds)}</Text>
      </Pressable>
    );
  }

  const shownExercises = isRunDay ? [] : currentSection?.exercises || [];
  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} style={softPress(styles.backButton, saving)} disabled={saving}>
          <Ionicons name="chevron-back" size={s(24)} color={COLORS.softGold} /><Text style={styles.backText}>Zurück</Text>
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <View style={styles.iconCircle}><Ionicons name={isRunDay ? 'walk-outline' : 'play-outline'} size={s(36)} color={COLORS.gold} /></View>
          <Text style={styles.title}>{selectedDay.name}</Text>
          <Text style={styles.subtitle}>{isRunDay ? 'Speichere deine Laufeinheit' : `${currentSection?.title || 'Training'} · Abschnitt ${sectionIndex + 1} von ${sections.length}`}</Text>
        </View>

        <Text style={styles.sectionLabel}>{isRunDay ? 'LAUFEINHEIT' : (currentSection?.title || 'ÜBUNGEN').toUpperCase()}</Text>
        {isRunDay ? (
          <View style={styles.sessionExerciseCard}>
            <View style={styles.sessionInputRow}>
              {[['Min.', runDurationMinutes, setRunDurationMinutes, '45', 'number-pad'], ['km', runDistanceKm, setRunDistanceKm, '6,0', 'decimal-pad'], ['Pace', runPace, setRunPace, '6:30', 'default']].map(([label,value,setter,placeholder,keyboard]) => (
                <View style={styles.sessionInputGroup} key={label}><Text style={styles.sessionInputLabel}>{label}</Text><TextInput style={styles.sessionSmallInput} keyboardType={keyboard} placeholder={placeholder} placeholderTextColor={COLORS.textFaint} value={value} onChangeText={setter} editable={!saving} /></View>
              ))}
            </View>
          </View>
        ) : shownExercises.map((exercise, index) => (
          <View key={exercise.id}>
            <View style={styles.sessionExerciseCard}>
              <View style={styles.sessionExerciseHeader}>
                <Text style={styles.sessionExerciseIndex}>{index + 1}</Text>
                <View style={styles.sessionExerciseTitleWrap}><Text style={styles.sessionExerciseName}>{exercise.name}</Text><Text style={styles.sessionExerciseHint}>Planwert: {exercise.weight ?? '-'} kg · {exercise.sets ?? '-'} Sätze · {exercise.reps ?? '-'} Wdh.</Text></View>
              </View>
              <View style={styles.sessionInputRow}>
                {[['kg','weight','decimal-pad'],['Sätze','sets','number-pad'],['Wdh.','reps','number-pad']].map(([label,field,keyboard]) => (
                  <View style={styles.sessionInputGroup} key={field}><Text style={styles.sessionInputLabel}>{label}</Text><TextInput style={styles.sessionSmallInput} keyboardType={keyboard} placeholder="-" placeholderTextColor={COLORS.textFaint} value={getExerciseValue(exercise, field)} onChangeText={value => updateExerciseValue(exercise.id, field, value)} editable={!saving} /></View>
                ))}
              </View>
              <TextInput style={styles.sessionNoteInput} placeholder="Notiz zur Übung" placeholderTextColor={COLORS.textFaint} value={getExerciseValue(exercise, 'note')} onChangeText={value => updateExerciseValue(exercise.id, 'note', value)} editable={!saving} multiline />
            </View>
            {index < shownExercises.length - 1 ? <Pressable style={softPress(styles.pauseStartButton)} onPress={() => { setPauseSeconds(PAUSE_SECONDS); setPauseTargetIndex(sectionIndex); }}><Text style={styles.pauseStartButtonText}>Pause starten</Text></Pressable> : null}
          </View>
        ))}

        <Text style={[styles.sectionLabel, { marginTop: sv(18) }]}>NOTIZ ZUR EINHEIT</Text>
        <TextInput style={styles.sessionOverallNoteInput} placeholder="Optional: Wie lief das Training?" placeholderTextColor={COLORS.textFaint} value={sessionNote} onChangeText={setSessionNote} editable={!saving} multiline />
        {saveError ? <Text style={styles.saveErrorText}>{saveError}</Text> : null}

        {!isRunDay && sectionIndex > 0 ? <Pressable style={softPress(styles.sectionSecondaryButton)} onPress={() => setSectionIndex(value => value - 1)}><Text style={styles.sectionSecondaryButtonText}>Vorherige Muskelgruppe</Text></Pressable> : null}
        {isRunDay ? <Pressable style={softPress(styles.saveBtn, saving)} onPress={saveSession} disabled={saving}>{saving ? <ActivityIndicator color={COLORS.black} /> : <Text style={styles.saveBtnText}>Lauf speichern</Text>}</Pressable>
          : sectionIndex < sections.length - 1
            ? <Pressable style={softPress(styles.saveBtn)} onPress={startSectionPause}><Text style={styles.saveBtnText}>Nächste Muskelgruppe</Text></Pressable>
            : <Pressable style={softPress(styles.saveBtn, saving)} onPress={confirmFinish} disabled={saving}>{saving ? <ActivityIndicator color={COLORS.black} /> : <Text style={styles.saveBtnText}>Training beenden</Text>}</Pressable>}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
