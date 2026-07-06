import { View, Text, TextInput, ActivityIndicator, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { COLORS } from '../../../../constants/colors';
import { s } from '../../../../constants/layout';
import PressableScale from '../../../../components/ui/PressableScale';
import {
  JOURNAL_QUESTIONS,
  formatJournalDate,
  getRelativeDayLabel,
} from '../utils/journalUtils';
import { styles } from '../styles/journalStyles';

export default function JournalDayPage({
  selectedDate,
  isFutureDay,
  currentDayEntry,
  showLoading,
  form,
  onUpdateForm,
  onToggleHabits,
  inputGestureProps,
  onTextInputTouchEnd,
  formError,
  canSave,
  saving,
  onSave,
}) {
  return (
    <View style={styles.bookPageCard}>
      <View style={styles.pageHeaderRow}>
        <View style={styles.pageBadge}>
          <Ionicons name="calendar-outline" size={s(16)} color={COLORS.gold} />
          <Text style={styles.pageBadgeText}>{getRelativeDayLabel(selectedDate)}</Text>
        </View>
        {showLoading ? (
          <ActivityIndicator color={COLORS.gold} size="small" />
        ) : currentDayEntry ? (
          <Text style={styles.pageEntryCount}>gespeichert</Text>
        ) : null}
      </View>

      <Text style={styles.bookPageTitle}>{formatJournalDate(selectedDate)}</Text>
      <Text style={styles.bookPageDescription}>
        {isFutureDay
          ? 'Diese Seite liegt in der Zukunft. Du kannst sie ansehen, aber noch nicht beschreiben.'
          : 'Reflektiere diesen Tag ehrlich. Genau hier entsteht dein Verlauf.'}
      </Text>

      <View style={styles.questionBlock}>
        <Text style={styles.questionText}>{JOURNAL_QUESTIONS.gratitude}</Text>
        <TextInput
          value={form.gratitude}
          onChangeText={(text) => onUpdateForm('gratitude', text)}
          editable={!isFutureDay}
          {...inputGestureProps}
          onTouchEnd={(event) => onTextInputTouchEnd(event, isFutureDay)}
          placeholder="z. B. Gesundheit, Training, Familie, Fortschritt ..."
          placeholderTextColor={COLORS.textFaint}
          multiline
          scrollEnabled={false}
          style={styles.input}
        />
      </View>

      <View style={styles.questionBlock}>
        <Text style={styles.questionText}>{JOURNAL_QUESTIONS.didWell}</Text>
        <TextInput
          value={form.didWell}
          onChangeText={(text) => onUpdateForm('didWell', text)}
          editable={!isFutureDay}
          {...inputGestureProps}
          onTouchEnd={(event) => onTextInputTouchEnd(event, isFutureDay)}
          placeholder="z. B. konzentriert gearbeitet, Sport gemacht ..."
          placeholderTextColor={COLORS.textFaint}
          multiline
          scrollEnabled={false}
          style={styles.input}
        />
      </View>

      <View style={styles.questionBlock}>
        <Text style={styles.questionText}>{JOURNAL_QUESTIONS.improveTomorrow}</Text>
        <TextInput
          value={form.improveTomorrow}
          onChangeText={(text) => onUpdateForm('improveTomorrow', text)}
          editable={!isFutureDay}
          {...inputGestureProps}
          onTouchEnd={(event) => onTextInputTouchEnd(event, isFutureDay)}
          placeholder="z. B. früher starten, weniger Handy, härter fokussieren ..."
          placeholderTextColor={COLORS.textFaint}
          multiline
          scrollEnabled={false}
          style={styles.input}
        />
      </View>

      <Pressable style={styles.checkboxRow} onPress={onToggleHabits}>
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
            onChangeText={(text) => onUpdateForm('missedHabits', text)}
            editable={!isFutureDay}
            {...inputGestureProps}
            onTouchEnd={(event) => onTextInputTouchEnd(event, isFutureDay)}
            placeholder="z. B. Lesen, Dehnen, frühes Schlafen ..."
            placeholderTextColor={COLORS.textFaint}
            multiline
            scrollEnabled={false}
            style={styles.input}
          />
        </View>
      )}

      {formError && <Text style={styles.errorText}>{formError}</Text>}

      <PressableScale
        style={[styles.saveButton, !canSave && styles.saveButtonDisabled]}
        onPress={onSave}
        disabled={!canSave}
      >
        {saving ? (
          <ActivityIndicator color={COLORS.gold} />
        ) : (
          <Text style={styles.saveText}>{currentDayEntry ? 'Änderungen speichern' : 'Journal speichern'}</Text>
        )}
      </PressableScale>
    </View>
  );
}
