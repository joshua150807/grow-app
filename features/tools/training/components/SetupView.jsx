import { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { COLORS } from '../../../../constants/colors';
import { s, sf, sv } from '../../../../constants/layout';
import { styles } from '../styles/trainingStyles';
import { PRESET_PLANS } from '../utils/trainingUtils';

function makeTempId() {
  return `t-${Math.random().toString(36).slice(2, 9)}`;
}

function emptyExercise() {
  return { id: makeTempId(), name: '', weight: '', sets: '', reps: '', note: '' };
}

function emptyDay() {
  return { id: makeTempId(), name: '', exercises: [emptyExercise()] };
}

function ChoiceView({ onSelectPresets, onSelectCustom }) {
  return (
    <View style={styles.screen}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={s(24)} color={COLORS.softGold} />
          <Text style={styles.backText}>Tools</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.iconCircle}>
            <Ionicons name="barbell-outline" size={s(36)} color={COLORS.gold} />
          </View>
          <Text style={styles.title}>TRAININGSPLAN</Text>
          <Text style={styles.subtitle}>Wie möchtest du starten?</Text>
        </View>

        <Pressable style={styles.setupChoiceCard} onPress={onSelectPresets}>
          <View style={styles.setupChoiceCardIconWrap}>
            <Ionicons name="list-outline" size={s(24)} color={COLORS.gold} />
          </View>
          <View style={styles.setupChoiceCardContent}>
            <Text style={styles.setupChoiceCardTitle}>Plan auswählen</Text>
            <Text style={styles.setupChoiceCardDesc}>
              Wähle einen vorgefertigten Plan und starte direkt
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={s(20)} color={COLORS.textDim} />
        </Pressable>

        <Pressable style={styles.setupChoiceCard} onPress={onSelectCustom}>
          <View style={styles.setupChoiceCardIconWrap}>
            <Ionicons name="create-outline" size={s(24)} color={COLORS.gold} />
          </View>
          <View style={styles.setupChoiceCardContent}>
            <Text style={styles.setupChoiceCardTitle}>Eigenen Plan erstellen</Text>
            <Text style={styles.setupChoiceCardDesc}>
              Erstelle einen Plan nach deinen Vorstellungen
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={s(20)} color={COLORS.textDim} />
        </Pressable>
      </ScrollView>
    </View>
  );
}

function PresetSelector({ onSave, onBack }) {
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  const handleSelectPreset = useCallback(
    async (preset) => {
      setSaving(true);
      setSaveError(null);
      try {
        await onSave(preset.name, preset.days);
      } catch {
        setSaveError('Plan konnte nicht geladen werden. Bitte versuche es erneut.');
        setSaving(false);
      }
    },
    [onSave]
  );

  return (
    <View style={styles.screen}>
      <View style={styles.topBar}>
        <Pressable onPress={onBack} style={styles.backButton} disabled={saving}>
          <Ionicons name="chevron-back" size={s(24)} color={COLORS.softGold} />
          <Text style={styles.backText}>Zurück</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.iconCircle}>
            <Ionicons name="barbell-outline" size={s(36)} color={COLORS.gold} />
          </View>
          <Text style={styles.title}>PLÄNE</Text>
          <Text style={styles.subtitle}>Wähle einen fertigen Plan</Text>
        </View>

        {saveError && (
          <Text style={styles.saveErrorText}>{saveError}</Text>
        )}

        {PRESET_PLANS.map(preset => (
          <Pressable
            key={preset.id}
            style={styles.presetCard}
            onPress={() => handleSelectPreset(preset)}
            disabled={saving}
            opacity={saving ? 0.5 : 1}
          >
            <View style={styles.presetCardIconWrap}>
              <Ionicons name={preset.icon} size={s(22)} color={COLORS.gold} />
            </View>
            <View style={styles.presetCardContent}>
              <Text style={styles.presetCardName}>{preset.name}</Text>
              <Text style={styles.presetCardDesc}>{preset.description}</Text>
              <Text style={styles.presetCardBadge}>
                {preset.days.length} {preset.days.length === 1 ? 'Trainingstag' : 'Trainingstage'}
              </Text>
            </View>
            {saving ? (
              <ActivityIndicator color={COLORS.gold} />
            ) : (
              <Ionicons name="chevron-forward" size={s(18)} color={COLORS.textDim} />
            )}
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

function CustomForm({ onSave, onBack }) {
  const [planName, setPlanName] = useState('');
  const [days, setDays] = useState([emptyDay()]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  const addDay = () => setDays(prev => [...prev, emptyDay()]);

  const removeDay = (dayId) =>
    setDays(prev => prev.filter(d => d.id !== dayId));

  const updateDayName = (dayId, name) =>
    setDays(prev => prev.map(d => (d.id === dayId ? { ...d, name } : d)));

  const addExercise = (dayId) =>
    setDays(prev =>
      prev.map(d =>
        d.id === dayId
          ? { ...d, exercises: [...d.exercises, emptyExercise()] }
          : d
      )
    );

  const removeExercise = (dayId, exId) =>
    setDays(prev =>
      prev.map(d =>
        d.id === dayId
          ? { ...d, exercises: d.exercises.filter(ex => ex.id !== exId) }
          : d
      )
    );

  const updateExercise = (dayId, exId, field, value) =>
    setDays(prev =>
      prev.map(d =>
        d.id === dayId
          ? {
              ...d,
              exercises: d.exercises.map(ex =>
                ex.id === exId ? { ...ex, [field]: value } : ex
              ),
            }
          : d
      )
    );

  const canSave =
    planName.trim().length > 0 &&
    days.length > 0 &&
    days.every(d => d.name.trim().length > 0);

  const handleSave = useCallback(async () => {
    if (!canSave || saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      const daysData = days.map(d => ({
        name: d.name.trim(),
        exercises: d.exercises.filter(ex => ex.name.trim()),
      }));
      await onSave(planName.trim(), daysData);
    } catch {
      setSaveError('Trainingsplan konnte nicht gespeichert werden. Bitte versuche es erneut.');
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
          placeholder="z.B. Push Pull Legs, Ganzkörper..."
          placeholderTextColor={COLORS.textFaint}
          value={planName}
          onChangeText={setPlanName}
          editable={!saving}
        />

        <Text style={[styles.sectionLabel, { marginTop: sv(24) }]}>
          TRAININGSTAGE
        </Text>

        {days.map((day, dayIndex) => (
          <View key={day.id} style={styles.setupDayCard}>
            <View style={styles.setupDayHeader}>
              <TextInput
                style={styles.setupDayNameInput}
                placeholder={`Tag ${dayIndex + 1}, z.B. Push`}
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

            {day.exercises.map((ex) => (
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
                {day.exercises.length > 1 && (
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
          </View>
        ))}

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

export function SetupView({ onSave }) {
  const [mode, setMode] = useState(null);

  if (mode === 'custom') {
    return <CustomForm onSave={onSave} onBack={() => setMode(null)} />;
  }

  if (mode === 'presets') {
    return <PresetSelector onSave={onSave} onBack={() => setMode(null)} />;
  }

  return (
    <ChoiceView
      onSelectPresets={() => setMode('presets')}
      onSelectCustom={() => setMode('custom')}
    />
  );
}
