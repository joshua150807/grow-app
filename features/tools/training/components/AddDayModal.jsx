import { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { COLORS } from '../../../../constants/colors';
import { s, sv } from '../../../../constants/layout';
import { styles } from '../styles/trainingStyles';

export function AddDayModal({ visible, onClose, onSave }) {
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const reset = () => {
    setName('');
    setError(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await onSave(name);
      reset();
    } catch {
      setError('Tag konnte nicht hinzugefügt werden.');
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Tag hinzufügen</Text>
              <Pressable onPress={handleClose} hitSlop={s(10)} disabled={saving}>
                <Ionicons name="close" size={s(24)} color={COLORS.textDim} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Text style={styles.modalLabel}>TAGNAME</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="z.B. Beine, Push, Oberkörper..."
                placeholderTextColor={COLORS.textFaint}
                value={name}
                onChangeText={setName}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={handleSave}
                editable={!saving}
              />

              {error ? <Text style={styles.modalError}>{error}</Text> : null}

              <Pressable
                style={[styles.modalSaveBtn, !name.trim() && styles.saveBtnDisabled]}
                onPress={handleSave}
                disabled={!name.trim() || saving}
              >
                {saving ? (
                  <ActivityIndicator color={COLORS.black} />
                ) : (
                  <Text style={styles.modalSaveBtnText}>Hinzufügen</Text>
                )}
              </Pressable>

              <View style={{ height: sv(8) }} />
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
