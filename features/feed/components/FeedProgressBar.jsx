import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { COLORS } from '../../../constants/colors';
import { SCREEN } from '../../../constants/layout';

const TOUCH_ZONE_HEIGHT = 120;
const TOUCH_ZONE_BELOW_LINE = 28;
const THUMB_SIZE = 12;

export default function FeedProgressBar({
  safeProgress,
  canScrub,
  thumbLeft,
  onTrackLayout,
  panHandlers,
  isScrubbing = false,
  currentTimeText = '0:00',
  durationText = '0:00',
}) {
  const insets = useSafeAreaInsets();

  const VISIBLE_TAB_BAR_HEIGHT = Math.round(
    Math.min(44, Math.max(34, SCREEN.height * 0.045))
  );

  const PROGRESS_LINE_GAP_ABOVE_TAB = 0;

  const progressLineBottom =
    insets.bottom +
    VISIBLE_TAB_BAR_HEIGHT +
    PROGRESS_LINE_GAP_ABOVE_TAB;

  const bottomOffset = progressLineBottom - TOUCH_ZONE_BELOW_LINE;

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFillObject}>
      {isScrubbing && (
        <View
          pointerEvents="none"
          style={[
            styles.timeContainer,
            { bottom: bottomOffset + TOUCH_ZONE_HEIGHT + 18 },
          ]}
        >
          <Text style={styles.timeText}>
            {currentTimeText} / {durationText}
          </Text>
        </View>
      )}

      <View
        style={[styles.progressArea, { bottom: bottomOffset }]}
        pointerEvents="box-none"
      >
        <View
          style={styles.progressTouchZone}
          onLayout={onTrackLayout}
          {...panHandlers}
        >
          <View
            style={[
              styles.progressTrack,
              isScrubbing && styles.progressTrackActive,
            ]}
          >
            <View
              style={[
                styles.progressFill,
                { width: `${safeProgress * 100}%` },
                isScrubbing && styles.progressFillActive,
              ]}
            />
          </View>

          {canScrub && isScrubbing && (
            <View
              pointerEvents="none"
              style={[
                styles.progressThumb,
                { left: thumbLeft },
              ]}
            />
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  progressArea: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 40,
  },

  progressTouchZone: {
    height: TOUCH_ZONE_HEIGHT,
    justifyContent: 'flex-end',
    paddingBottom: TOUCH_ZONE_BELOW_LINE,
  },

  progressTrack: {
    width: '100%',
    height: 1,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.10)',
    overflow: 'hidden',
  },

  progressTrackActive: {
    height: 5,
    backgroundColor: 'rgba(255,255,255,0.26)',
  },

  progressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.55)',
  },

  progressFillActive: {
    backgroundColor: COLORS.white,
  },

  progressThumb: {
    position: 'absolute',
    top: TOUCH_ZONE_HEIGHT - TOUCH_ZONE_BELOW_LINE - THUMB_SIZE / 2,
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    backgroundColor: COLORS.white,
    shadowColor: COLORS.black,
    shadowOpacity: 0.3,
    shadowRadius: 4,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    elevation: 4,
  },

  timeContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 45,
  },

  timeText: {
    color: COLORS.white,
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: 0.2,
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowOffset: {
      width: 0,
      height: 1,
    },
    textShadowRadius: 5,
  },
});