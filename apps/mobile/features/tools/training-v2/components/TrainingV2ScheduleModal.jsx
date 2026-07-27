import { useEffect, useState } from 'react';
import { Modal, Platform, Pressable, Text, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';

import { COLORS } from '../../../../constants/colors';
import { getTrainingV2DeviceTimeZone, toLocalDateString } from '../services/trainingV2DeviceTimeZone';
import { styles } from '../styles/trainingV2Styles';

export function TrainingV2ScheduleModal({
  visible, pending, error, onClose, onConfirm,
}) {
  const [date, setDate] = useState(() => new Date());

  useEffect(() => {
    if (visible) setDate(new Date());
  }, [visible]);

  const timeZone = getTrainingV2DeviceTimeZone();

  return (
    <Modal animationType="slide" onRequestClose={onClose} transparent visible={visible}>
      <View style={styles.modalRoot}>
        <Pressable onPress={onClose} style={styles.modalBackdrop} />
        <View style={styles.modalSheet}>
          <Pressable accessibilityRole="button" onPress={onClose} style={styles.modalClose}>
            <Text style={styles.modalCloseText}>Schließen</Text>
          </Pressable>
          <Text style={styles.modalTitle}>Plan vormerken</Text>
          <Text style={styles.formHint}>Zeitzone: {timeZone}</Text>
          {error ? <Text style={styles.formErrorText}>{error.message}</Text> : null}

          <DateTimePicker
            accentColor={COLORS.gold}
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            mode="date"
            onChange={(_event, selectedDate) => {
              if (selectedDate) setDate(selectedDate);
            }}
            style={styles.datePicker}
            themeVariant="dark"
            value={date}
          />

          <View style={styles.modalPrimaryButtonWrap}>
            <Pressable
              accessibilityRole="button"
              disabled={pending}
              onPress={() => onConfirm(toLocalDateString(date), timeZone)}
              style={[styles.saveButton, pending && styles.saveButtonDisabled]}
            >
              <Text style={styles.saveButtonText}>Vormerken</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
