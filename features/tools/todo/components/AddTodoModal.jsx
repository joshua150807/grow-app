import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';

import { COLORS } from '../../../../constants/colors';
import { s, sf, sv } from '../../../../constants/layout';
import PressableScale from '../../../../components/ui/PressableScale';

export function AddTodoModal({
  visible,
  onClose,
  inputTitle,
  setInputTitle,
  selectedDate,
  setSelectedDate,
  showDatePicker,
  setShowDatePicker,
  androidStep,
  setAndroidStep,
  datePickerLabel,
  adding,
  onAdd,
  isEditing = false,
}) {
  const submitDisabled = !inputTitle.trim() || adding;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? sv(10) : 0}
      >
        <Pressable style={styles.overlay} onPress={onClose}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <View style={styles.sheetHandle} />

            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.formContent}
            >
              <Text style={styles.sheetTitle}>
              {isEditing ? 'Aufgabe bearbeiten' : 'Neue Aufgabe'}
              </Text>

              <TextInput
              style={styles.input}
              placeholder="Was willst du erledigen?"
              placeholderTextColor={COLORS.textDim}
              value={inputTitle}
              onChangeText={setInputTitle}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={onAdd}
            />

            <PressableScale
              style={[styles.dateToggle, showDatePicker && styles.dateToggleActive]}
              activeScale={0.985}
              activeOpacity={0.88}
              onPress={() => {
                if (!showDatePicker) {
                  setSelectedDate(selectedDate ?? new Date(Date.now() + 60 * 60 * 1000));
                  setShowDatePicker(true);
                } else {
                  setShowDatePicker(false);
                  setSelectedDate(null);
                  setAndroidStep('date');
                }
              }}
            >
              <Ionicons
                name={showDatePicker ? 'time' : 'time-outline'}
                size={s(17)}
                color={showDatePicker ? COLORS.gold : COLORS.textSecondary}
              />

              <Text style={[styles.dateToggleText, showDatePicker && styles.dateToggleTextActive]}>
                {datePickerLabel}
              </Text>

              {showDatePicker && (
                <Ionicons name="close-circle" size={s(16)} color={COLORS.textDim} />
              )}
            </PressableScale>

            {showDatePicker && (
              <DateTimePicker
                value={selectedDate ?? new Date()}
                mode={Platform.OS === 'android' ? androidStep : 'datetime'}
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                minimumDate={new Date()}
                themeVariant="dark"
                accentColor={COLORS.gold}
                onChange={(event, date) => {
                  if (Platform.OS === 'android') {
                    if (event.type === 'dismissed') {
                      setShowDatePicker(false);
                      setAndroidStep('date');
                    } else if (androidStep === 'date') {
                      setSelectedDate(date);
                      setAndroidStep('time');
                    } else {
                      setSelectedDate(date);
                      setShowDatePicker(false);
                      setAndroidStep('date');
                    }
                  } else if (date) {
                    setSelectedDate(date);
                  }
                }}
                style={styles.datePicker}
              />
            )}

            <View style={styles.modalButtons}>
              <View style={styles.modalButtonSlot}>
                <PressableScale
                  style={styles.cancelBtn}
                  activeScale={0.975}
                  activeOpacity={0.84}
                  onPress={onClose}
                >
                  <Text style={styles.cancelBtnText}>Abbrechen</Text>
                </PressableScale>
              </View>

              <View style={styles.modalButtonSlot}>
                <PressableScale
                  style={[styles.confirmBtn, submitDisabled && styles.confirmBtnDisabled]}
                  activeScale={0.975}
                  activeOpacity={0.86}
                  onPress={onAdd}
                  disabled={submitDisabled}
                >
                  {adding ? (
                    <ActivityIndicator color={COLORS.black} size="small" />
                  ) : (
                    <Text style={styles.confirmBtnText}>
                      {isEditing ? 'Speichern' : 'Hinzufügen'}
                    </Text>
                  )}
                </PressableScale>
              </View>
            </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  keyboardView: {
    flex: 1,
    backgroundColor: COLORS.black,
  },
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.66)',
  },
  sheet: {
    maxHeight: '88%',
    backgroundColor: COLORS.background,
    borderTopLeftRadius: s(28),
    borderTopRightRadius: s(28),
    paddingHorizontal: s(20),
    paddingTop: sv(12),
    paddingBottom: Platform.OS === 'ios' ? sv(30) : sv(22),
    borderTopWidth: 1,
    borderColor: COLORS.goldBorder,
  },
  formContent: {
    paddingBottom: Platform.OS === 'ios' ? sv(18) : sv(12),
  },
  sheetHandle: {
    width: s(44),
    height: sv(4),
    borderRadius: s(999),
    backgroundColor: COLORS.goldBorder,
    alignSelf: 'center',
    marginBottom: sv(16),
    opacity: 0.85,
  },
  sheetTitle: {
    color: COLORS.white,
    fontSize: sf(21),
    fontWeight: '800',
    marginBottom: sv(16),
  },
  input: {
    minHeight: sv(52),
    borderRadius: s(15),
    borderWidth: 1,
    borderColor: COLORS.goldBorder,
    backgroundColor: COLORS.darkCard,
    color: COLORS.white,
    paddingHorizontal: s(14),
    fontSize: sf(15),
    fontWeight: '600',
  },
  dateToggle: {
    minHeight: sv(48),
    borderRadius: s(15),
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.18)',
    backgroundColor: 'rgba(255,255,255,0.035)',
    marginTop: sv(12),
    paddingHorizontal: s(14),
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(9),
  },
  dateToggleActive: {
    borderColor: COLORS.goldBorder,
    backgroundColor: 'rgba(212,175,55,0.06)',
  },
  dateToggleText: {
    flex: 1,
    color: COLORS.textSecondary,
    fontSize: sf(13),
    fontWeight: '700',
  },
  dateToggleTextActive: {
    color: COLORS.gold,
  },
  datePicker: {
    marginTop: sv(8),
  },
  modalButtons: {
    flexDirection: 'row',
    gap: s(10),
    marginTop: sv(16),
  },
  modalButtonSlot: {
    flex: 1,
  },
  cancelBtn: {
    minHeight: sv(48),
    borderRadius: s(15),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.darkCard,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  cancelBtnText: {
    color: COLORS.textSecondary,
    fontSize: sf(14),
    fontWeight: '800',
  },
  confirmBtn: {
    minHeight: sv(48),
    borderRadius: s(15),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.gold,
  },
  confirmBtnDisabled: {
    opacity: 0.45,
  },
  confirmBtnText: {
    color: COLORS.black,
    fontSize: sf(14),
    fontWeight: '900',
  },
});