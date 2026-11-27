import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, Text, TextInput, View } from 'react-native';

import AppButton from '../../../components/ui/AppButton';
import { COLORS } from '../../../constants/colors';
import { mentorStyles as styles } from '../styles/mentorStyles';

const TITLE_MAX_LENGTH = 80;

export default function MentorRenameModal({
  visible,
  initialTitle,
  saving,
  onCancel,
  onSave,
  heading = 'Chat umbenennen',
  placeholder = 'Titel',
  maxLength = TITLE_MAX_LENGTH,
  multiline = false,
}) {
  const [title, setTitle] = useState(initialTitle ?? '');

  useEffect(() => {
    if (visible) setTitle(initialTitle ?? '');
  }, [visible, initialTitle]);

  const trimmed = title.trim();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <KeyboardAvoidingView
        style={styles.modalBackdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>{heading}</Text>
          <TextInput
            style={styles.modalInput}
            value={title}
            onChangeText={setTitle}
            maxLength={maxLength}
            autoFocus
            multiline={multiline}
            selectionColor={COLORS.gold}
            placeholder={placeholder}
            placeholderTextColor={COLORS.textFaint}
            returnKeyType="done"
            blurOnSubmit
            onSubmitEditing={() => trimmed && onSave(trimmed)}
          />
          <View style={styles.modalActions}>
            <Pressable onPress={onCancel} style={styles.modalCancel}>
              <Text style={styles.modalCancelText}>Abbrechen</Text>
            </Pressable>
            <AppButton
              title={saving ? 'Speichern…' : 'Speichern'}
              onPress={() => onSave(trimmed)}
              disabled={saving || !trimmed}
              style={styles.modalSave}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
