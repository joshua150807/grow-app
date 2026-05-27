import { Pressable, StyleSheet, Text } from 'react-native';

import { COLORS } from '../../../../constants/colors';
import { s, sv, sf } from '../../../../constants/layout';
import {
  SLOT_HEIGHT,
  TIME_LABEL_WIDTH,
  MINUTES_PER_SLOT,
  timeToMinutes,
} from '../utils/plannerUtils';

export function PlannerEventItem({ event, onPress, timelineWidth }) {
  const startMinutes = timeToMinutes(event.start_time);
  const endMinutes = timeToMinutes(event.end_time);

  const durationMinutes = Math.max(1, endMinutes - startMinutes);
  const topPx = (startMinutes / MINUTES_PER_SLOT) * SLOT_HEIGHT + 1;

  const heightPx = Math.max(
    (durationMinutes / MINUTES_PER_SLOT) * SLOT_HEIGHT - 3,
    sv(22)
  );

  const columnCount = event.layout?.columnCount || 1;
  const columnIndex = event.layout?.columnIndex || 0;

  const leftBase = TIME_LABEL_WIDTH + s(8);
  const rightPadding = s(14);
  const columnGap = s(6);

  const safeTimelineWidth = timelineWidth || 0;

  const availableWidth = Math.max(
    s(120),
    safeTimelineWidth - leftBase - rightPadding
  );

  const eventWidth =
    (availableWidth - columnGap * (columnCount - 1)) / columnCount;

  const eventLeft = leftBase + columnIndex * (eventWidth + columnGap);

  return (
    <Pressable
      style={[
        styles.eventBlock,
        {
          top: topPx,
          height: heightPx,
          left: eventLeft,
          width: eventWidth,
          backgroundColor: event.color || COLORS.gold,
        },
      ]}
      onPress={() => onPress(event)}
    >
      <Text style={styles.eventTitle} numberOfLines={1}>
        {event.title}
      </Text>

      <Text style={styles.eventTime} numberOfLines={1}>
        {event.start_time.slice(0, 5)} – {event.end_time.slice(0, 5)}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  eventBlock: {
    position: 'absolute',
    borderRadius: s(8),
    paddingHorizontal: s(8),
    paddingVertical: sv(3),
    justifyContent: 'center',
    overflow: 'hidden',
  },

  eventTitle: {
    color: COLORS.black,
    fontSize: sf(11),
    fontWeight: '900',
  },

  eventTime: {
    color: 'rgba(0,0,0,0.65)',
    fontSize: sf(9),
    fontWeight: '700',
    marginTop: sv(1),
  },
});