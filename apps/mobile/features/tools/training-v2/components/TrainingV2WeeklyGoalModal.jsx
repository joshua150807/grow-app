import { useEffect, useState } from 'react';
import { Modal, Pressable, Text, TextInput, View } from 'react-native';

import { styles } from '../styles/trainingV2Styles';

function parsePositiveInteger(value) {
  const parsed = Number(value.trim());
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export function TrainingV2WeeklyGoalModal({
  visible, currentValue, pending, error, onClose, onConfirm,
}) {
  const [value, setValue] = useState('');

  useEffect(() => {
    if (visible) setValue(currentValue !== null && currentValue !== undefined ? String(currentValue) : '');
  }, [visible, currentValue]);

  const parsedGoal = parsePositiveInteger(value);
  const isValid = parsedGoal !== null;

  return (
    <Modal animationType="slide" onRequestClose={onClose} transparent visible={visible}>
      <View style={styles.modalRoot}>
        <Pressable onPress={onClose} style={styles.modalBackdrop} />
        <View style={styles.modalSheet}>
          <Pressable accessibilityRole="button" onPress={onClose} style={styles.modalClose}>
            <Text style={styles.modalCloseText}>Schließen</Text>
          </Pressable>
          <Text style={styles.modalTitle}>Wochenziel ändern</Text>
          {error ? <Text style={styles.formErrorText}>{error.message}</Text> : null}

          <TextInput
            keyboardType="numeric"
            onChangeText={setValue}
            placeholder="z. B. 4"
            placeholderTextColor="#6F6A77"
            style={styles.formInput}
            value={value}
          />
          {!isValid && value.length > 0 ? (
            <Text style={styles.formErrorText}>Das Wochenziel muss eine positive Ganzzahl sein.</Text>
          ) : null}

          <View style={styles.modalPrimaryButtonWrap}>
            <Pressable
              accessibilityRole="button"
              disabled={pending || !isValid}
              onPress={() => onConfirm(parsedGoal)}
              style={[styles.saveButton, (pending || !isValid) && styles.saveButtonDisabled]}
            >
              <Text style={styles.saveButtonText}>Speichern</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
