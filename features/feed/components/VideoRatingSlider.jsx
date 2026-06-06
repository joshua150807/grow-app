import { useEffect, useMemo, useRef, useState } from 'react';
import { PanResponder, StyleSheet, Text, View } from 'react-native';

import { COLORS } from '../../../constants/colors';
import { s, sv, sf } from '../../../constants/layout';
import { RATINGS } from '../hooks/useVideoRating';

const TRACK_HEIGHT = sv(200);
const TRACK_WIDTH = s(2);
const THUMB_SIZE = s(13);
const PREVIEW_SIZE = s(38);
const HIT_WIDTH = s(48);
const CLEAR_ZONE_RADIUS = sv(18);

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function getZoneIndexFromY(y) {
  const zoneHeight = TRACK_HEIGHT / RATINGS.length;
  return clamp(Math.floor(y / zoneHeight), 0, RATINGS.length - 1);
}

function getSnapYForIndex(index) {
  const zoneHeight = TRACK_HEIGHT / RATINGS.length;
  return zoneHeight * index + zoneHeight / 2;
}

function getSnapYForRating(ratingKey) {
  const index = RATINGS.findIndex((rating) => rating.key === ratingKey);

  if (index === -1) {
    return TRACK_HEIGHT / 2;
  }

  return getSnapYForIndex(index);
}

function isInClearZone(yPosition) {
  return Math.abs(yPosition - TRACK_HEIGHT / 2) <= CLEAR_ZONE_RADIUS;
}

export default function VideoRatingSlider({
  currentRating = null,
  onRatingSubmit = () => {},
  onRatingClear = () => {},
  onDragStart = () => {},
  onDragEnd = () => {},
  disabled = false,
}) {
  const [thumbY, setThumbY] = useState(() => getSnapYForRating(currentRating));
  const [previewIndex, setPreviewIndex] = useState(() => getZoneIndexFromY(thumbY));
  const [isDragging, setIsDragging] = useState(false);

  const latestThumbYRef = useRef(thumbY);
  const dragStartYRef = useRef(thumbY);

  const selectedRating = RATINGS[previewIndex] ?? RATINGS[0];

  useEffect(() => {
    latestThumbYRef.current = thumbY;
  }, [thumbY]);

  useEffect(() => {
    if (isDragging) return;

    const nextY = getSnapYForRating(currentRating);

    setThumbY(nextY);
    setPreviewIndex(getZoneIndexFromY(nextY));
  }, [currentRating, isDragging]);

  const commitRating = (yPosition) => {
    if (isInClearZone(yPosition)) {
      setThumbY(TRACK_HEIGHT / 2);
      setPreviewIndex(getZoneIndexFromY(TRACK_HEIGHT / 2));
      setIsDragging(false);

      if (currentRating) {
        onRatingClear();
      }

      return;
    }

    const nextIndex = getZoneIndexFromY(yPosition);
    const nextRating = RATINGS[nextIndex];
    const nextY = getSnapYForIndex(nextIndex);

    setThumbY(nextY);
    setPreviewIndex(nextIndex);
    setIsDragging(false);

    if (nextRating?.key && nextRating.key !== currentRating) {
      onRatingSubmit(nextRating.key);
    }
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => !disabled,
        onStartShouldSetPanResponderCapture: () => !disabled,
        onMoveShouldSetPanResponder: () => !disabled,
        onMoveShouldSetPanResponderCapture: () => !disabled,
        onShouldBlockNativeResponder: () => true,
        onPanResponderTerminationRequest: () => false,

        onPanResponderGrant: (event) => {
          const touchY = clamp(
            event.nativeEvent.locationY ?? latestThumbYRef.current,
            0,
            TRACK_HEIGHT,
          );

          dragStartYRef.current = touchY;
          latestThumbYRef.current = touchY;

          setThumbY(touchY);
          setPreviewIndex(getZoneIndexFromY(touchY));
          setIsDragging(true);

          onDragStart();
        },

        onPanResponderMove: (_, gestureState) => {
          const nextY = clamp(dragStartYRef.current + gestureState.dy, 0, TRACK_HEIGHT);

          latestThumbYRef.current = nextY;

          setThumbY(nextY);
          setPreviewIndex(getZoneIndexFromY(nextY));
        },

        onPanResponderRelease: () => {
          commitRating(latestThumbYRef.current);
          onDragEnd();
        },

        onPanResponderTerminate: () => {
          commitRating(latestThumbYRef.current);
          onDragEnd();
        },
      }),
    [currentRating, disabled, onDragStart, onDragEnd],
  );

  return (
    <View
      style={styles.container}
      pointerEvents={disabled ? 'none' : 'auto'}
      {...panResponder.panHandlers}
    >
      {isDragging && selectedRating && !isInClearZone(thumbY) && (
        <View
          style={[styles.previewBubble, { top: thumbY - PREVIEW_SIZE / 2 }]}
          pointerEvents="none"
        >
          <Text style={styles.previewEmoji}>{selectedRating.emoji}</Text>
        </View>
      )}

      <View style={styles.trackWrap} pointerEvents="none">
        <View style={styles.trackGlow} />
        <View style={styles.track} />

        {[0, 0.25, 0.5, 0.75, 1].map((position) => (
          <View
            key={position}
            style={[
              styles.tick,
              {
                top: TRACK_HEIGHT * position - StyleSheet.hairlineWidth,
              },
            ]}
          />
        ))}
      </View>

      <View style={[styles.thumb, { top: thumbY - THUMB_SIZE / 2 }]} pointerEvents="none">
        <View style={styles.thumbCore} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: HIT_WIDTH,
    height: TRACK_HEIGHT,
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingRight: s(8),
  },

  trackWrap: {
    position: 'absolute',
    right: s(14),
    top: 0,
    width: s(18),
    height: TRACK_HEIGHT,
    alignItems: 'center',
  },

  trackGlow: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: s(4),
    borderRadius: s(4),
    backgroundColor: 'rgba(242,223,180,0.025)',
  },

  track: {
    width: TRACK_WIDTH,
    height: TRACK_HEIGHT,
    borderRadius: TRACK_WIDTH,
    backgroundColor: COLORS.softGold,
    opacity: 0.72,
  },

  tick: {
    position: 'absolute',
    right: s(2),
    width: s(8),
    height: StyleSheet.hairlineWidth,
    backgroundColor: COLORS.gold,
    opacity: 0.55,
  },

  thumb: {
    position: 'absolute',
    right: s(16.5),
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.softGold,
    shadowColor: COLORS.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: s(10),
    elevation: 8,
  },

  thumbCore: {
    width: s(5),
    height: s(5),
    borderRadius: s(2.5),
    backgroundColor: COLORS.white,
    opacity: 0.85,
  },

  previewBubble: {
    position: 'absolute',
    right: s(42),
    width: PREVIEW_SIZE,
    height: PREVIEW_SIZE,
    borderRadius: PREVIEW_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(242,223,180,0.9)',
    backgroundColor: 'rgba(0,0,0,0.58)',
    shadowColor: COLORS.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.75,
    shadowRadius: s(9),
    elevation: 9,
  },

  previewEmoji: {
    fontSize: sf(18),
  },
});