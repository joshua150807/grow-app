import { View, Text, Modal, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';

import { COLORS } from '../../../../constants/colors';
import { s } from '../../../../constants/layout';
import PressableScale from '../../../../components/ui/PressableScale';
import { styles } from '../styles/journalStyles';

export default function JournalCalendarModal({
  visible,
  onClose,
  selectedDateObject,
  onCalendarChange,
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.calendarModal}>
          <View style={styles.tocHeaderRow}>
            <View>
              <Text style={styles.tocTitle}>Kalender</Text>
              <Text style={styles.tocSubtitle}>Wähle einen Tag aus.</Text>
            </View>
            <PressableScale onPress={onClose} hitSlop={s(8)} activeScale={0.94}>
              <Ionicons name="close" size={s(24)} color={COLORS.textDim} />
            </PressableScale>
          </View>

          <DateTimePicker
            value={selectedDateObject}
            mode="date"
            display={Platform.OS === 'ios' ? 'inline' : 'calendar'}
            onChange={onCalendarChange}
            themeVariant="dark"
            accentColor={COLORS.gold}
            textColor={COLORS.softGold}
            positiveButton={{ label: 'Auswählen', textColor: COLORS.gold }}
            negativeButton={{ label: 'Abbrechen', textColor: COLORS.softGold }}
            style={styles.datePicker}
          />
        </View>
      </View>
    </Modal>
  );
}
