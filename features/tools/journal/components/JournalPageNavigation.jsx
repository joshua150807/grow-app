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
        {isStarterPage ? (
          <Text style={styles.pageNavQuestionNumber} numberOfLines={1}>
            {starterPage?.eyebrow}
          </Text>
        ) : (
          <>
            <Text style={styles.pageNavKicker}>{getRelativeDayLabel(selectedDate)}</Text>
            <View style={styles.pageNavTitleRow}>
              <Text style={styles.pageNavTitle} numberOfLines={1}>
                {formatShortJournalDate(selectedDate)}
              </Text>
              <Ionicons
                name="calendar-outline"
                size={s(15)}
                color={COLORS.textDim}
                style={styles.pageNavCalendarIcon}
              />
            </View>
          </>
        )}
      </PressableScale>

      <PressableScale onPress={onNextPage} style={styles.pageArrowButton} activeScale={0.94}>
        <Ionicons name="chevron-forward" size={s(24)} color={COLORS.softGold} />
      </PressableScale>
    </View>
  );
}
