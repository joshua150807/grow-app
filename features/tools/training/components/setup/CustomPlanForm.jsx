import { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  AppState,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { COLORS } from '../../../../../constants/colors';
import { s, sv, sf } from '../../../../../constants/layout';
import { styles } from '../../styles/trainingStyles';
import {
  loadCustomTrainingPlanDraft,
  saveCustomTrainingPlanDraft,
  clearCustomTrainingPlanDraft,
} from '../../services/trainingDraftStorage';

const DAY_TYPES = [
  { value: 'gym', label: 'Gym', icon: 'barbell-outline' },
  { value: 'run', label: 'Laufen', icon: 'walk-outline' },
  { value: 'rest', label: 'Rest', icon: 'moon-outline' },
];

function makeTempId() {
  return `t-${Math.random().toString(36).slice(2, 9)}`;
}

function emptyExercise() {
  return { id: makeTempId(), name: '', weight: '', sets: '', reps: '', note: '' };
}

function emptyDay(type = 'gym') {
  return {
    id: makeTempId(),
    type,
    name: '',
    exercises: type === 'gym' ? [emptyExercise()] : [],
  };
}

function normalizeDayType(value) {
  if (value === 'run') return 'run';
  if (value === 'rest') return 'rest';
  return 'gym';
}

function getDefaultDayName(type, index) {
  if (type === 'run') return `Laufen ${index + 1}`;
  if (type === 'rest') return `Rest ${index + 1}`;
  return `Tag ${index + 1}`;
}

function safeText(value, fallback = '') {
  if (value === null || value === undefined) return fallback;
  return String(value).trim();
}

function parsePositiveInteger(value) {
  const text = safeText(value);
  if (!text) return null;

  const parsed = parseInt(text, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function normalizeExercise(exercise) {
  return {
    name: safeText(exercise?.name),
    weight: safeText(exercise?.weight),
    sets: safeText(exercise?.sets),
    reps: safeText(exercise?.reps),
    note: safeText(exercise?.note),
  };
}

function normalizeDay(day, index) {
  const type = normalizeDayType(day?.type);
  const exercises = Array.isArray(day?.exercises) ? day.exercises : [];

  return {
    type,
    name: safeText(day?.name, getDefaultDayName(type, index)),
    exercises: type === 'gym'
      ? exercises
          .map(normalizeExercise)
          .filter((exercise) => exercise.name.length > 0)
      : [],
  };
}

function getValidationError(planName, daysData) {
  if (!safeText(planName)) {
    return 'Gib deinem Trainingsplan einen Namen.';
  }

  if (!daysData.length) {
    return 'Füge mindestens einen Trainingstag hinzu.';
  }

  for (let dayIndex = 0; dayIndex < daysData.length; dayIndex += 1) {
    const day = daysData[dayIndex];
    const dayName = day.name || getDefaultDayName(day.type, dayIndex);

    if (!safeText(day.name)) {
      return `Tag ${dayIndex + 1} braucht einen Namen.`;
    }

    if (day.type === 'run' || day.type === 'rest') {
      continue;
    }

    if (day.exercises.length === 0) {
      return `${dayName}: Füge mindestens eine Übung hinzu oder stelle den Tag auf Laufen/Rest.`;
    }

    for (const exercise of day.exercises) {
      if (!exercise.name) continue;

      if (parsePositiveInteger(exercise.sets) === null) {
        return `${dayName}: "${exercise.name}" braucht eine Satzzahl größer 0.`;
      }

      if (parsePositiveInteger(exercise.reps) === null) {
        return `${dayName}: "${exercise.name}" braucht Wiederholungen größer 0.`;
      }
    }
  }

  return null;
}

export function CustomPlanForm({ onSave, onBack }) {
  const [planName, setPlanName] = useState('');
  const [days, setDays] = useState([emptyDay()]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [draftRestored, setDraftRestored] = useState(false);
  const draftReadyRef = useRef(false);
  const planNameRef = useRef(planName);
  const daysRef = useRef(days);

  useEffect(() => {
    planNameRef.current = planName;
  }, [planName]);

  useEffect(() => {
    daysRef.current = days;
  }, [days]);

  useEffect(() => {
    let mounted = true;

    async function restoreDraft() {
      const draft = await loadCustomTrainingPlanDraft();

      if (!mounted) return;

      if (draft) {
        setPlanName(draft.planName || '');
        setDays(draft.days || [emptyDay()]);
        setDraftRestored(true);
      }

      draftReadyRef.current = true;
    }

    restoreDraft();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!draftReadyRef.current) return undefined;

    const timeout = setTimeout(() => {
      saveCustomTrainingPlanDraft({
        planName,
        days,
      });
    }, 350);

    return () => clearTimeout(timeout);
  }, [planName, days]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'inactive' || nextState === 'background') {
        saveCustomTrainingPlanDraft({
          planName: planNameRef.current,
          days: daysRef.current,
        });
      }
    });

    return () => subscription.remove();
  }, []);

  const addDay = () => setDays(prev => [...prev, emptyDay()]);

  const removeDay = (dayId) =>
    setDays(prev => prev.filter(d => d.id !== dayId));

  const updateDayName = (dayId, name) =>
    setDays(prev => prev.map(d => (d.id === dayId ? { ...d, name } : d)));

  const updateDayType = (dayId, type) =>
    setDays(prev =>
      prev.map(d => {
        if (d.id !== dayId) return d;
        if (type === 'run') {
          return { ...d, type: 'run', exercises: [] };
        }

        if (type === 'rest') {
          return { ...d, type: 'rest', exercises: [] };
        }

        return {
          ...d,
          type: 'gym',
          exercises: d.exercises?.length ? d.exercises : [emptyExercise()],
        };
      })
    );

  const addExercise = (dayId) =>
    setDays(prev =>
      prev.map(d =>
        d.id === dayId
          ? { ...d, type: 'gym', exercises: [...(d.exercises || []), emptyExercise()] }
          : d
      )
    );

  const removeExercise = (dayId, exId) =>
    setDays(prev =>
      prev.map(d =>
        d.id === dayId
          ? { ...d, exercises: (d.exercises || []).filter(ex => ex.id !== exId) }
          : d
      )
    );

  const updateExercise = (dayId, exId, field, value) =>
    setDays(prev =>
      prev.map(d =>
        d.id === dayId
          ? {
              ...d,
              exercises: (d.exercises || []).map(ex =>
                ex.id === exId ? { ...ex, [field]: value } : ex
              ),
            }
          : d
      )
    );

  const normalizedDays = days.map(normalizeDay);

  const canSave =
    safeText(planName).length > 0 &&
    normalizedDays.length > 0 &&
    normalizedDays.every((day) => day.name.length > 0);

  const handleSave = useCallback(async () => {
    if (!canSave || saving) return;

    setSaving(true);
    setSaveError(null);

    try {
      const daysData = days.map(normalizeDay);
      const cleanPlanName = safeText(planName, 'Mein Trainingsplan');
      const validationError = getValidationError(cleanPlanName, daysData);

      if (validationError) {
        setSaveError(validationError);
        return;
      }

      console.log('[Training Setup] Saving custom plan', {
        planName: cleanPlanName,
        dayCount: daysData.length,
        gymDayCount: daysData.filter((day) => day.type === 'gym').length,
        runDayCount: daysData.filter((day) => day.type === 'run').length,
        restDayCount: daysData.filter((day) => day.type === 'rest').length,
        exerciseCount: daysData.reduce((sum, day) => sum + day.exercises.length, 0),
      });

      await onSave(cleanPlanName, daysData);
      await clearCustomTrainingPlanDraft();
    } catch (e) {
      console.error('[Training Setup] Custom plan save failed:', e);
      setSaveError(e?.message || 'Trainingsplan konnte nicht gespeichert werden. Bitte versuche es erneut.');
    } finally {
      setSaving(false);
    }
  }, [canSave, saving, planName, days, onSave]);

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.topBar}>
        <Pressable onPress={onBack} style={styles.backButton} disabled={saving}>
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
            <Ionicons name="barbell-outline" size={s(36)} color={COLORS.gold} />
          </View>
          <Text style={styles.title}>TRAININGSPLAN</Text>
          <Text style={styles.subtitle}>Erstelle deinen persönlichen Plan</Text>
        </View>

        <Text style={styles.sectionLabel}>PLANNAME</Text>
        <TextInput
          style={styles.input}
          placeholder="z.B. Upper Lower, Hybrid, Lauf & Gym..."
          placeholderTextColor={COLORS.textFaint}
          value={planName}
          onChangeText={setPlanName}
          editable={!saving}
        />

        {draftRestored ? (
          <View style={localStyles.draftRestoredCard}>
            <Ionicons name="cloud-done-outline" size={s(17)} color={COLORS.gold} />
            <Text style={localStyles.draftRestoredText}>Dein angefangener Plan wurde wiederhergestellt.</Text>
          </View>
        ) : null}

        <Text style={[styles.sectionLabel, { marginTop: sv(24) }]}>TRAININGSTAGE</Text>

        {days.map((day, dayIndex) => {
          const isRunDay = day.type === 'run';
          const isRestDay = day.type === 'rest';

          return (
            <View key={day.id} style={styles.setupDayCard}>
              <View style={styles.setupDayHeader}>
                <TextInput
                  style={styles.setupDayNameInput}
                  placeholder={isRunDay ? `Tag ${dayIndex + 1}, z.B. Zone 2 Lauf` : isRestDay ? `Tag ${dayIndex + 1}, z.B. Rest Day` : `Tag ${dayIndex + 1}, z.B. Upper`}
                  placeholderTextColor={COLORS.textFaint}
                  value={day.name}
                  onChangeText={val => updateDayName(day.id, val)}
                  editable={!saving}
                />
                {days.length > 1 && (
                  <Pressable
                    onPress={() => removeDay(day.id)}
                    hitSlop={s(8)}
                    disabled={saving}
                  >
                    <Ionicons name="trash-outline" size={s(18)} color={COLORS.error} />
                  </Pressable>
                )}
              </View>

              <View style={localStyles.dayTypeRow}>
                {DAY_TYPES.map((typeOption) => {
                  const active = day.type === typeOption.value;

                  return (
                    <Pressable
                      key={typeOption.value}
                      style={[localStyles.dayTypePill, active && localStyles.dayTypePillActive]}
                      onPress={() => updateDayType(day.id, typeOption.value)}
                      disabled={saving}
                    >
                      <Ionicons
                        name={typeOption.icon}
                        size={s(15)}
                        color={active ? COLORS.black : COLORS.softGold}
                      />
                      <Text style={[localStyles.dayTypeText, active && localStyles.dayTypeTextActive]}>
                        {typeOption.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {isRunDay || isRestDay ? (
                <View style={localStyles.runHintCard}>
                  <Ionicons name={isRunDay ? 'walk-outline' : 'moon-outline'} size={s(18)} color={COLORS.gold} />
                  <View style={{ flex: 1 }}>
                    <Text style={localStyles.runHintTitle}>{isRunDay ? 'Lauftag' : 'Rest Day'}</Text>
                    <Text style={localStyles.runHintText}>
                      {isRunDay
                        ? 'Für Lauftage brauchst du keine Übungen. Dauer und Distanz trägst du später beim Speichern der Laufeinheit ein.'
                        : 'Rest Days werden im Plan angezeigt, aber nicht als Trainingseinheit gespeichert.'}
                    </Text>
                  </View>
                </View>
              ) : (
                <>
                  {(day.exercises || []).map((ex) => (
                    <View key={ex.id} style={styles.setupExerciseRow}>
                      <View style={styles.setupExerciseInputs}>
                        <TextInput
                          style={styles.setupExerciseNameInput}
                          placeholder="Übungsname"
                          placeholderTextColor={COLORS.textFaint}
                          value={ex.name}
                          onChangeText={val => updateExercise(day.id, ex.id, 'name', val)}
                          editable={!saving}
                        />
                        <View style={styles.setupExerciseDetailsRow}>
                          <TextInput
                            style={styles.setupExerciseSmallInput}
                            placeholder="kg"
                            placeholderTextColor={COLORS.textFaint}
                            keyboardType="decimal-pad"
                            value={ex.weight}
                            onChangeText={val => updateExercise(day.id, ex.id, 'weight', val)}
                            editable={!saving}
                          />
                          <TextInput
                            style={styles.setupExerciseSmallInput}
                            placeholder="Sätze"
                            placeholderTextColor={COLORS.textFaint}
                            keyboardType="number-pad"
                            value={ex.sets}
                            onChangeText={val => updateExercise(day.id, ex.id, 'sets', val)}
                            editable={!saving}
                          />
                          <TextInput
                            style={styles.setupExerciseSmallInput}
                            placeholder="Wdh."
                            placeholderTextColor={COLORS.textFaint}
                            keyboardType="number-pad"
                            value={ex.reps}
                            onChangeText={val => updateExercise(day.id, ex.id, 'reps', val)}
                            editable={!saving}
                          />
                        </View>
                        <TextInput
                          style={styles.setupExerciseNoteInput}
                          placeholder="Notiz (optional)"
                          placeholderTextColor={COLORS.textFaint}
                          value={ex.note}
                          onChangeText={val => updateExercise(day.id, ex.id, 'note', val)}
                          editable={!saving}
                        />
                      </View>
                      {(day.exercises || []).length > 1 && (
                        <Pressable
                          onPress={() => removeExercise(day.id, ex.id)}
                          hitSlop={s(8)}
                          style={styles.setupExerciseDeleteBtn}
                          disabled={saving}
                        >
                          <Ionicons
                            name="close-circle-outline"
                            size={s(20)}
                            color={COLORS.textDim}
                          />
                        </Pressable>
                      )}
                    </View>
                  ))}

                  <Pressable
                    style={styles.setupAddExerciseBtn}
                    onPress={() => addExercise(day.id)}
                    disabled={saving}
                  >
                    <Ionicons name="add-outline" size={s(18)} color={COLORS.softGold} />
                    <Text style={styles.setupAddExerciseBtnText}>Übung hinzufügen</Text>
                  </Pressable>
                </>
              )}
            </View>
          );
        })}

        <Pressable style={styles.addDayBtn} onPress={addDay} disabled={saving}>
          <Ionicons name="add-circle-outline" size={s(20)} color={COLORS.gold} />
          <Text style={styles.addDayBtnText}>Tag hinzufügen</Text>
        </Pressable>

        {saveError ? (
          <Text style={styles.saveErrorText}>{saveError}</Text>
        ) : null}

        <Pressable
          style={[styles.saveBtn, (!canSave || saving) && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={!canSave || saving}
        >
          {saving ? (
            <ActivityIndicator color={COLORS.black} />
          ) : (
            <Text style={styles.saveBtnText}>Plan erstellen</Text>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const localStyles = {
  dayTypeRow: {
    flexDirection: 'row',
    gap: s(8),
    marginBottom: sv(12),
  },
  dayTypePill: {
    flex: 1,
    minHeight: sv(36),
    borderRadius: s(12),
    borderWidth: 1,
    borderColor: COLORS.goldBorder,
    backgroundColor: COLORS.darkCard,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: s(6),
  },
  dayTypePillActive: {
    backgroundColor: COLORS.gold,
    borderColor: COLORS.gold,
  },
  dayTypeText: {
    color: COLORS.softGold,
    fontSize: sf(12),
    fontWeight: '800',
  },
  dayTypeTextActive: {
    color: COLORS.black,
  },
  draftRestoredCard: {
    borderRadius: s(12),
    borderWidth: 1,
    borderColor: COLORS.goldBorder,
    backgroundColor: 'rgba(212,175,55,0.08)',
    paddingVertical: sv(10),
    paddingHorizontal: s(12),
    marginTop: sv(14),
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(8),
  },
  draftRestoredText: {
    color: COLORS.paleGold,
    fontSize: sf(12),
    fontWeight: '700',
    flex: 1,
  },
  runHintCard: {
    borderRadius: s(12),
    borderWidth: 1,
    borderColor: COLORS.goldBorder,
    backgroundColor: 'rgba(212,175,55,0.08)',
    padding: s(12),
    flexDirection: 'row',
    gap: s(10),
    alignItems: 'flex-start',
  },
  runHintTitle: {
    color: COLORS.paleGold,
    fontSize: sf(13),
    fontWeight: '800',
    marginBottom: sv(4),
  },
  runHintText: {
    color: COLORS.textMuted,
    fontSize: sf(12),
    lineHeight: sf(17),
  },
};
