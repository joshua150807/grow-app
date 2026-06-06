import { useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  ImageBackground,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { COLORS } from '../../../../constants/colors';
import { JOURNAL_PAGE_BG } from '../../../../constants/toolAssets';
import { s } from '../../../../constants/layout';

import { useJournalEntries } from '../hooks/useJournalEntries';
import {
  JOURNAL_QUESTIONS,
  getLastSevenJournalDays,
  formatEntryTime,
  isJournalEntryValid,
} from '../utils/journalUtils';
import { styles } from '../styles/journalStyles';
import PressableScale from '../../../../components/ui/PressableScale';
import { useDelayedLoading } from '../../../../hooks/useDelayedLoading';

const emptyForm = {
  gratitude: '',
  didWell: '',
  improveTomorrow: '',
  habitsCompleted: true,
  missedHabits: '',
};

export default function JournalScreen() {
  const days = useMemo(() => getLastSevenJournalDays(), []);
  const [selectedDate, setSelectedDate] = useState(days[0].iso);
  const [form, setForm] = useState(emptyForm);
  const [editingEntry, setEditingEntry] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);

  const {
    visibleEntries,
    entriesByDate,
    loading,
    loadError,
    actionError,
    setActionError,
    loadEntries,
    add,
    update,
    remove,
  } = useJournalEntries(selectedDate);

  const selectedDay = days.find(day => day.iso === selectedDate);
  const showLoading = useDelayedLoading(loading);

  const updateForm = useCallback((key, value) => {
    setForm(prev => ({ ...prev, [key]: value }));
  }, []);

  const resetForm = useCallback(() => {
    setForm(emptyForm);
    setEditingEntry(null);
    setFormError(null);
  }, []);

  const handleSelectDate = useCallback((date) => {
    setSelectedDate(date);
    resetForm();
  }, [resetForm]);

  const handleEdit = useCallback((entry) => {
    setEditingEntry(entry);
    setForm({
      gratitude: entry.gratitude || '',
      didWell: entry.did_well || '',
      improveTomorrow: entry.improve_tomorrow || '',
      habitsCompleted: entry.habits_completed !== false,
      missedHabits: entry.missed_habits || '',
    });
    setFormError(null);
  }, []);

  const handleSave = useCallback(async () => {
    const payload = {
      entryDate: selectedDate,
      gratitude: form.gratitude.trim(),
      didWell: form.didWell.trim(),
      improveTomorrow: form.improveTomorrow.trim(),
      habitsCompleted: form.habitsCompleted,
      missedHabits: form.missedHabits.trim(),
    };

    if (!isJournalEntryValid(payload)) {
      setFormError('Fülle mindestens ein Feld aus.');
      return;
    }

    if (!payload.habitsCompleted && !payload.missedHabits) {
      setFormError('Gib kurz an, welche Gewohnheiten heute nicht geklappt haben.');
      return;
    }

    setSaving(true);
    setFormError(null);

    try {
      if (editingEntry) {
        await update(editingEntry.id, payload);
      } else {
        await add(payload);
      }
      resetForm();
    } catch (e) {
      setFormError('Eintrag konnte nicht gespeichert werden. Bitte versuche es erneut.');
    } finally {
      setSaving(false);
    }
  }, [selectedDate, form, editingEntry, add, update, resetForm]);

  const canSave = !saving && isJournalEntryValid(form);

  return (
    <View style={styles.screen}>
      <ImageBackground
        source={JOURNAL_PAGE_BG}
        style={styles.background}
        imageStyle={styles.backgroundImage}
        resizeMode="cover"
      >
        <View style={styles.backgroundOverlay}>
      <View style={styles.topBar}>
        <PressableScale onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={s(24)} color={COLORS.softGold} />
          <Text style={styles.backText}>Tools</Text>
        </PressableScale>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.iconCircle}>
            <Ionicons name="journal-outline" size={s(38)} color={COLORS.gold} />
          </View>
          <Text style={styles.title}>JOURNAL</Text>
          <Text style={styles.subtitle}>Reflektiere deinen Tag. Bleib ehrlich mit dir.</Text>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Letzte 7 Tage</Text>
          <Text style={styles.infoText}>
            Dein Journal zeigt nur die letzten 7 Tage. Ältere Einträge werden automatisch beim Öffnen oder Speichern entfernt.
          </Text>
        </View>

        {loadError && (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>{loadError}</Text>
            <PressableScale onPress={loadEntries} style={styles.retryBtn}>
              <Text style={styles.retryText}>Erneut versuchen</Text>
            </PressableScale>
          </View>
        )}

        {actionError && (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle-outline" size={s(16)} color={COLORS.errorLight} />
            <Text style={styles.errorText}>{actionError}</Text>
            <PressableScale onPress={() => setActionError(null)} hitSlop={s(8)} activeScale={0.94}>
              <Ionicons name="close" size={s(16)} color={COLORS.textDim} />
            </PressableScale>
          </View>
        )}

        <View style={styles.dayRow}>
          {days.map(day => {
            const active = selectedDate === day.iso;
            const hasEntries = entriesByDate[day.iso] > 0;

            return (
              <Pressable
                key={day.iso}
                style={[styles.dayBtn, active && styles.dayBtnActive]}
                onPress={() => handleSelectDate(day.iso)}
              >
                <Text style={[styles.dayLabel, active && styles.dayLabelActive]} numberOfLines={1}>
                  {day.label}
                </Text>
                <Text style={[styles.dayDate, active && styles.dayDateActive]}>{day.shortDate}</Text>
                {hasEntries && <View style={styles.dayDot} />}
              </Pressable>
            );
          })}
        </View>

        <View style={styles.formCard}>
          <View style={styles.formHeaderRow}>
            <Text style={styles.formTitle}>
              {editingEntry ? 'Eintrag bearbeiten' : `${selectedDay?.label || 'Tag'} reflektieren`}
            </Text>
            {editingEntry && (
              <PressableScale onPress={resetForm} hitSlop={s(8)} activeScale={0.96}>
                <Text style={styles.cancelText}>Abbrechen</Text>
              </PressableScale>
            )}
          </View>

          <View style={styles.questionBlock}>
            <Text style={styles.questionText}>{JOURNAL_QUESTIONS.gratitude}</Text>
            <TextInput
              value={form.gratitude}
              onChangeText={(text) => updateForm('gratitude', text)}
              placeholder="z. B. Gesundheit, Training, Familie, Fortschritt ..."
              placeholderTextColor={COLORS.textFaint}
              multiline
              style={styles.input}
            />
          </View>

          <View style={styles.questionBlock}>
            <Text style={styles.questionText}>{JOURNAL_QUESTIONS.didWell}</Text>
            <TextInput
              value={form.didWell}
              onChangeText={(text) => updateForm('didWell', text)}
              placeholder="z. B. konzentriert gearbeitet, Sport gemacht ..."
              placeholderTextColor={COLORS.textFaint}
              multiline
              style={styles.input}
            />
          </View>

          <View style={styles.questionBlock}>
            <Text style={styles.questionText}>{JOURNAL_QUESTIONS.improveTomorrow}</Text>
            <TextInput
              value={form.improveTomorrow}
              onChangeText={(text) => updateForm('improveTomorrow', text)}
              placeholder="z. B. früher starten, weniger Handy, härter fokussieren ..."
              placeholderTextColor={COLORS.textFaint}
              multiline
              style={styles.input}
            />
          </View>

          <Pressable
            style={styles.checkboxRow}
            onPress={() => updateForm('habitsCompleted', !form.habitsCompleted)}
          >
            <View style={[styles.checkbox, form.habitsCompleted && styles.checkboxActive]}>
              {form.habitsCompleted && (
                <Ionicons name="checkmark" size={s(17)} color={COLORS.gold} />
              )}
            </View>
            <Text style={styles.checkboxText}>Ich habe heute alle Gewohnheiten erfüllt</Text>
          </Pressable>

          {!form.habitsCompleted && (
            <View style={styles.questionBlock}>
              <Text style={styles.questionText}>Welche Gewohnheiten haben nicht geklappt?</Text>
              <TextInput
                value={form.missedHabits}
                onChangeText={(text) => updateForm('missedHabits', text)}
                placeholder="z. B. Lesen, Dehnen, frühes Schlafen ..."
                placeholderTextColor={COLORS.textFaint}
                multiline
                style={styles.input}
              />
            </View>
          )}

          {formError && <Text style={styles.errorText}>{formError}</Text>}

          <PressableScale
            style={[styles.saveButton, !canSave && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={!canSave}
          >
            {saving ? (
              <ActivityIndicator color={COLORS.gold} />
            ) : (
              <Text style={styles.saveText}>{editingEntry ? 'Änderungen speichern' : 'Journal speichern'}</Text>
            )}
          </PressableScale>
        </View>

        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>EINTRÄGE</Text>
          <Text style={styles.sectionCount}>{visibleEntries.length} gespeichert</Text>
        </View>

        {showLoading ? (
          <View style={styles.emptyState}>
            <ActivityIndicator color={COLORS.gold} />
          </View>
        ) : !loading && visibleEntries.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="journal-outline" size={s(42)} color={COLORS.textDim} />
            <Text style={styles.emptyText}>Noch kein Eintrag.</Text>
            <Text style={styles.emptySubText}>Schreibe kurz auf, was heute zählt.</Text>
          </View>
        ) : !loading ? (
          <View style={styles.list}>
            {visibleEntries.map(entry => (
              <View key={entry.id} style={styles.entryCard}>
                <View style={styles.entryHeaderRow}>
                  <Text style={styles.entryTime}>{formatEntryTime(entry.created_at)}</Text>
                  <View style={styles.entryActions}>
                    <PressableScale onPress={() => handleEdit(entry)} hitSlop={s(8)} activeScale={0.94}>
                      <Ionicons name="create-outline" size={s(20)} color={COLORS.softGold} />
                    </PressableScale>
                    <PressableScale onPress={() => remove(entry.id)} hitSlop={s(8)} activeScale={0.94}>
                      <Ionicons name="trash-outline" size={s(20)} color={COLORS.errorLight} />
                    </PressableScale>
                  </View>
                </View>

                {!!entry.gratitude && (
                  <>
                    <Text style={styles.entryQuestion}>{JOURNAL_QUESTIONS.gratitude}</Text>
                    <Text style={styles.entryAnswer}>{entry.gratitude}</Text>
                  </>
                )}

                {!!entry.did_well && (
                  <>
                    <Text style={styles.entryQuestion}>{JOURNAL_QUESTIONS.didWell}</Text>
                    <Text style={styles.entryAnswer}>{entry.did_well}</Text>
                  </>
                )}

                {!!entry.improve_tomorrow && (
                  <>
                    <Text style={styles.entryQuestion}>{JOURNAL_QUESTIONS.improveTomorrow}</Text>
                    <Text style={styles.entryAnswer}>{entry.improve_tomorrow}</Text>
                  </>
                )}

                <Text style={styles.habitsDone}>
                  Gewohnheiten: {entry.habits_completed ? 'alle erfüllt' : 'nicht alle erfüllt'}
                </Text>

                {!entry.habits_completed && !!entry.missed_habits && (
                  <Text style={styles.entryAnswer}>{entry.missed_habits}</Text>
                )}
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>
        </View>
      </ImageBackground>
    </View>
  );
}