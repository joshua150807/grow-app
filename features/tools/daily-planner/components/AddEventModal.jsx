import {
  ActivityIndicator,
  Keyboard,
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
import { s, sv, sf } from '../../../../constants/layout';
import {
  EVENT_COLORS,
  dateToDayMinutes,
  dayMinutesToDate,
  formatDurationLabel,
  minutesToTime,
} from '../utils/plannerUtils';

export function AddEventModal({
  visible,
  onClose,
  sheetTitle = 'Neuer Termin',
  modalFromPlus,
  modalStartMinutes,
  setModalStartMinutes,
  modalShowPicker,
  setModalShowPicker,
  modalPickerDate,
  setModalPickerDate,
  modalTitle,
  setModalTitle,
  modalDuration,
  setModalDuration,
  modalColor,
  setModalColor,
  saving,
  onSave,
}) {
  const durationPickerDate = dayMinutesToDate(modalDuration);

  const handleClose = () => {
    Keyboard.dismiss();
    onClose();
  };

  const handleDurationChange = (event, date) => {
    if (Platform.OS === 'android') {
      if (event.type !== 'dismissed' && date) {
        const nextDuration = Math.max(1, dateToDayMinutes(date));
        setModalDuration(nextDuration);
      }

      return;
    }

    if (date) {
      const nextDuration = Math.max(1, dateToDayMinutes(date));
      setModalDuration(nextDuration);
    }
  };

  const handleStartTimeChange = (event, date) => {
    if (Platform.OS === 'android') {
      if (event.type !== 'dismissed' && date) {
        setModalStartMinutes(dateToDayMinutes(date));
        setModalPickerDate(date);
      }

      setModalShowPicker(false);
      return;
    }

    if (date) {
      setModalStartMinutes(dateToDayMinutes(date));
      setModalPickerDate(date);
    }
  };

  const canSave =
    modalTitle.trim().length > 0 &&
    modalStartMinutes !== null &&
    !saving;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? sv(10) : 0}
      >
        <Pressable style={styles.overlay} onPress={handleClose}>
          <Pressable style={styles.sheet} onPress={() => Keyboard.dismiss()}>
            <View style={styles.sheetHandle} />

            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.formContent}
            >
              <Text style={styles.sheetTitle}>{sheetTitle}</Text>

            {!modalFromPlus && (
              <Text style={styles.sheetSub}>
                ab {minutesToTime(modalStartMinutes ?? 0)} Uhr
              </Text>
            )}

            {modalFromPlus && (
              <>
                <Pressable
                  style={({ pressed }) => [
                    styles.timeToggle,
                    modalStartMinutes !== null && styles.timeToggleActive,
                    pressed && styles.pressedSubtle,
                  ]}
                  onPress={() => {
                    Keyboard.dismiss();
                    setModalShowPicker(value => !value);
                  }}
                >
                  <Ionicons
                    name={modalStartMinutes !== null ? 'time' : 'time-outline'}
                    size={s(17)}
                    color={modalStartMinutes !== null ? COLORS.gold : COLORS.textSecondary}
                  />

                  <Text
                    style={[
                      styles.timeToggleText,
                      modalStartMinutes !== null && styles.timeToggleTextActive,
                    ]}
                  >
                    {modalStartMinutes !== null
                      ? `${minutesToTime(modalStartMinutes)} Uhr`
                      : 'Uhrzeit wählen'}
                  </Text>

                  <Ionicons
                    name={modalShowPicker ? 'chevron-up' : 'chevron-down'}
                    size={s(14)}
                    color={COLORS.textDim}
                  />
                </Pressable>

                {modalShowPicker && (
                  <View style={styles.startTimePickerWrap}>
                    <DateTimePicker
                      value={modalPickerDate}
                      mode="time"
                      display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                      themeVariant="dark"
                      accentColor={COLORS.gold}
                      onChange={handleStartTimeChange}
                      style={styles.datePicker}
                    />

                    <Pressable
                      style={({ pressed }) => [styles.startTimeDoneBtn, pressed && styles.pressedCircle]}
                      onPress={() => setModalShowPicker(false)}
                      hitSlop={s(8)}
                    >
                      <Ionicons name="checkmark" size={s(20)} color={COLORS.black} />
                    </Pressable>
                  </View>
                )}
              </>
            )}

            <TextInput
              style={styles.input}
              placeholder="Titel"
              placeholderTextColor={COLORS.textDim}
              value={modalTitle}
              onChangeText={setModalTitle}
              autoFocus={false}
              returnKeyType="done"
              blurOnSubmit
              onSubmitEditing={() => Keyboard.dismiss()}
            />

            <Text style={styles.durationLabel}>
              DAUER · {formatDurationLabel(modalDuration)}
            </Text>

            <View style={styles.durationPickerWrap}>
              <DateTimePicker
                value={durationPickerDate}
                mode="time"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                themeVariant="dark"
                accentColor={COLORS.gold}
                onChange={handleDurationChange}
                style={styles.durationPicker}
              />
            </View>

            <Text style={styles.durationLabel}>FARBE</Text>

            <View style={styles.colorRow}>
              {EVENT_COLORS.map(color => {
                const isActive = modalColor === color.value;

                return (
                  <Pressable
                    key={color.key}
                    style={({ pressed }) => [
                      styles.colorDot,
                      {
                        backgroundColor: color.value,
                        borderColor: isActive ? COLORS.white : 'rgba(255,255,255,0.18)',
                      },
                      pressed && styles.pressedCircle,
                    ]}
                    onPress={() => {
                      Keyboard.dismiss();
                      setModalColor(color.value);
                    }}
                    accessibilityLabel={color.label}
                  >
                    {isActive && (
                      <Ionicons name="checkmark" size={s(14)} color={COLORS.black} />
                    )}
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.modalBtns}>
              <Pressable style={({ pressed }) => [styles.cancelBtn, pressed && styles.pressedSecondary]} onPress={handleClose}>
                <Text style={styles.cancelBtnText}>Abbrechen</Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [
                  styles.confirmBtn,
                  !canSave && styles.confirmBtnDisabled,
                  pressed && canSave && styles.pressedPrimary,
                ]}
                onPress={() => {
                  Keyboard.dismiss();
                  onSave();
                }}
                disabled={!canSave}
              >
                {saving ? (
                  <ActivityIndicator color={COLORS.black} size="small" />
                ) : (
                  <Text style={styles.confirmBtnText}>Speichern</Text>
                )}
              </Pressable>
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
    backgroundColor: 'rgba(0,0,0,0.72)',
  },
  sheet: {
    maxHeight: '88%',
    backgroundColor: COLORS.background,
    borderTopLeftRadius: s(26),
    borderTopRightRadius: s(26),
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
    width: s(42),
    height: sv(4),
    borderRadius: s(999),
    backgroundColor: COLORS.goldBorder,
    alignSelf: 'center',
    marginBottom: sv(16),
  },
  sheetTitle: {
    color: COLORS.white,
    fontSize: sf(21),
    fontWeight: '800',
    marginBottom: sv(6),
  },
  sheetSub: {
    color: COLORS.textSecondary,
    fontSize: sf(13),
    fontWeight: '700',
    marginBottom: sv(14),
  },
  timeToggle: {
    minHeight: sv(48),
    borderRadius: s(14),
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.18)',
    backgroundColor: 'rgba(255,255,255,0.035)',
    marginBottom: sv(12),
    paddingHorizontal: s(14),
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(9),
  },
  timeToggleActive: {
    borderColor: COLORS.goldBorder,
    backgroundColor: 'rgba(212,175,55,0.06)',
  },
  timeToggleText: {
    flex: 1,
    color: COLORS.textSecondary,
    fontSize: sf(13),
    fontWeight: '700',
  },
  timeToggleTextActive: {
    color: COLORS.gold,
  },
  datePicker: {
    marginBottom: sv(8),
    alignSelf: 'stretch',
  },
  input: {
    minHeight: sv(52),
    borderRadius: s(14),
    borderWidth: 1,
    borderColor: COLORS.goldBorder,
    backgroundColor: COLORS.darkCard,
    color: COLORS.white,
    paddingHorizontal: s(14),
    fontSize: sf(15),
    fontWeight: '600',
    marginBottom: sv(14),
  },
  durationLabel: {
    color: COLORS.textSecondary,
    fontSize: sf(12),
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: sv(10),
  },
  durationPickerWrap: {
    borderRadius: s(14),
    borderWidth: 1,
    borderColor: COLORS.goldBorder,
    backgroundColor: COLORS.darkCard,
    marginBottom: sv(16),
    overflow: 'hidden',
  },
  colorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: s(10),
    marginBottom: sv(4),
  },
  colorDot: {
    width: s(34),
    height: s(34),
    borderRadius: s(17),
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBtns: {
    flexDirection: 'row',
    gap: s(10),
    marginTop: sv(18),
  },
  cancelBtn: {
    flex: 1,
    minHeight: sv(48),
    borderRadius: s(14),
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
    flex: 1,
    minHeight: sv(48),
    borderRadius: s(14),
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
  startTimePickerWrap: {
    position: 'relative',
    borderRadius: s(14),
    borderWidth: 1,
    borderColor: COLORS.goldBorder,
    backgroundColor: COLORS.darkCard,
    overflow: 'hidden',
    marginBottom: sv(12),
  },

  startTimeDoneBtn: {
    position: 'absolute',
    right: s(12),
    bottom: sv(12),
    width: s(36),
    height: s(36),
    borderRadius: s(18),
    backgroundColor: COLORS.gold,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
    elevation: 20,
  },

  datePicker: {
    alignSelf: 'stretch',
  },
  pressedSubtle: {
    opacity: 0.84,
    transform: [{ scale: 0.99 }],
  },
  pressedCircle: {
    opacity: 0.82,
    transform: [{ scale: 0.94 }],
  },
  pressedSecondary: {
    opacity: 0.78,
    transform: [{ scale: 0.985 }],
  },
  pressedPrimary: {
    opacity: 0.86,
    transform: [{ scale: 0.985 }],
  },
});