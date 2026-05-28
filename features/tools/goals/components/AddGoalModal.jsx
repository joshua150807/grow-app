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
import { Ionicons } from '@expo/vector-icons';

import { COLORS } from '../../../../constants/colors';
import { s, sv, sf } from '../../../../constants/layout';
import PressableScale from '../../../../components/ui/PressableScale';

export function AddGoalModal({
  visible,
  onClose,
  inputName,
  setInputName,
  inputDeadline,
  setInputDeadline,
  addError,
  canAdd,
  adding,
  onAdd,
  isEditing = false,
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
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
                {isEditing ? 'Ziel bearbeiten' : 'Neues Ziel'}
              </Text>

              <TextInput
                style={[styles.input, styles.nameInput]}
                placeholder="Mein Ziel"
                placeholderTextColor={COLORS.textDim}
                value={inputName}
                onChangeText={setInputName}
                autoFocus
                multiline
                textAlignVertical="top"
                returnKeyType="next"
              />

              <TextInput
                style={styles.input}
                placeholder="Deadline (optional, z.B. 31.12.2026)"
                placeholderTextColor={COLORS.textDim}
                value={inputDeadline}
                onChangeText={setInputDeadline}
                returnKeyType="done"
              />

              {addError && (
                <View style={styles.modalErrorRow}>
                  <Ionicons name="alert-circle-outline" size={s(15)} color="#FF6B6B" />
                  <Text style={styles.modalErrorText}>{addError}</Text>
                </View>
              )}

              <View style={styles.modalButtons}>
                <PressableScale style={styles.cancelBtn} onPress={onClose} activeScale={0.97} activeOpacity={0.86}>
                  <Text style={styles.cancelBtnText}>Abbrechen</Text>
                </PressableScale>

                <PressableScale
                  style={[styles.confirmBtn, (!canAdd || adding) && styles.confirmBtnDisabled]}
                  onPress={onAdd}
                  disabled={!canAdd || adding}
                  activeScale={0.97}
                  activeOpacity={0.9}
                >
                  {adding ? (
                    <ActivityIndicator color={COLORS.black} />
                  ) : (
                    <Text style={styles.confirmBtnText}>
                      {isEditing ? 'Speichern' : 'Hinzufügen'}
                    </Text>
                  )}
                </PressableScale>
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
    marginBottom: sv(16),
  },
  input: {
    minHeight: sv(52),
    borderRadius: s(14),
    borderWidth: 1,
    borderColor: COLORS.goldBorder,
    backgroundColor: COLORS.darkCard,
    color: COLORS.white,
    paddingHorizontal: s(14),
    paddingVertical: sv(12),
    fontSize: sf(15),
    fontWeight: '600',
    marginBottom: sv(10),
  },
  nameInput: {
    minHeight: sv(90),
    maxHeight: sv(160),
  },
  modalErrorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(7),
    marginTop: sv(8),
  },
  modalErrorText: {
    flex: 1,
    color: '#FF6B6B',
    fontSize: sf(12),
    fontWeight: '700',
  },
  modalButtons: {
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
});