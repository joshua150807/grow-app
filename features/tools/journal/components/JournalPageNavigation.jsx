import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { COLORS } from '../../../../constants/colors';
import { s } from '../../../../constants/layout';
import PressableScale from '../../../../components/ui/PressableScale';
import {
  formatShortJournalDate,
  getRelativeDayLabel,
} from '../utils/journalUtils';
import { styles } from '../styles/journalStyles';

export default function JournalPageNavigation({
  isStarterPage,
  starterPage,
  selectedDate,
  onPreviousPage,
  onNextPage,
  onOpenCalendar,
}) {
  return (
    <View style={styles.pageNavCard}>
      <PressableScale onPress={onPreviousPage} style={styles.pageArrowButton} activeScale={0.94}>
        <Ionicons name="chevron-back" size={s(24)} color={COLORS.softGold} />
      </PressableScale>

      <PressableScale
        onPress={onOpenCalendar}
        style={styles.pageNavCenter}
        activeScale={isStarterPage ? 1 : 0.96}
        disabled={isStarterPage}
      >
        <Text style={styles.pageNavKicker}>
          {isStarterPage ? starterPage?.eyebrow : getRelativeDayLabel(selectedDate)}
        </Text>
        <View style={styles.pageNavTitleRow}>
          <Text style={styles.pageNavTitle} numberOfLines={1}>
            {isStarterPage ? starterPage?.title : formatShortJournalDate(selectedDate)}
          </Text>
          {!isStarterPage && (
            <Ionicons name="calendar-outline" size={s(15)} color={COLORS.textDim} />
          )}
        </View>
      </PressableScale>

      <PressableScale onPress={onNextPage} style={styles.pageArrowButton} activeScale={0.94}>
        <Ionicons name="chevron-forward" size={s(24)} color={COLORS.softGold} />
      </PressableScale>
    </View>
  );
}
