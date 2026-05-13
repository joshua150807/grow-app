import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PanResponder } from 'react-native';

const PROGRESS_UPDATE_INTERVAL = 150;
const THUMB_SIZE = 10;

const clamp = (value, min, max) => {
  return Math.max(min, Math.min(value, max));
};

export function useVideoProgress({
  player,
  isActive,
  isFeedFocused,
  isScrubbing,
  setIsScrubbing,
}) {
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [trackWidth, setTrackWidth] = useState(0);

  const dragStartXRef = useRef(0);
  const latestDurationRef = useRef(0);

  useEffect(() => {
    let intervalId;

    if (isActive && isFeedFocused && !isScrubbing) {
      intervalId = setInterval(() => {
        const current = player.currentTime ?? 0;
        const total = player.duration ?? 0;

        latestDurationRef.current = total;
        setDuration(total);

        if (total > 0) {
          const nextProgress = current / total;
          setProgress(clamp(nextProgress, 0, 1));
        } else {
          setProgress(0);
        }
      }, PROGRESS_UPDATE_INTERVAL);
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [isActive, isFeedFocused, isScrubbing, player]);

  const canScrub = duration > 0 && trackWidth > 0;

  const setProgressFromX = useCallback(
    (x) => {
      if (!canScrub) return null;

      const clampedX = clamp(x, 0, trackWidth);
      const ratio = clampedX / trackWidth;

      setProgress(ratio);
      return ratio;
    },
    [canScrub, trackWidth]
  );

  const seekToProgress = useCallback(
    (ratio) => {
      const total = latestDurationRef.current || duration;

      if (!player || !total || typeof ratio !== 'number') return;

      player.currentTime = clamp(ratio, 0, 1) * total;
    },
    [duration, player]
  );

  const progressPanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => canScrub,
        onStartShouldSetPanResponderCapture: () => false,

        onMoveShouldSetPanResponder: (event, gestureState) => {
          if (!canScrub) return false;

          const isHorizontalMove =
            Math.abs(gestureState.dx) > Math.abs(gestureState.dy);

          const isIntentionalMove = Math.abs(gestureState.dx) > 2;

          return isHorizontalMove && isIntentionalMove;
        },

        onMoveShouldSetPanResponderCapture: () => false,

        onPanResponderGrant: (event) => {
          setIsScrubbing(true);

          const startX = event.nativeEvent.locationX;
          dragStartXRef.current = startX;

          const ratio = setProgressFromX(startX);
          seekToProgress(ratio);
        },

        onPanResponderMove: (event, gestureState) => {
          if (!canScrub) return;

          const nextX = dragStartXRef.current + gestureState.dx;
          setProgressFromX(nextX);
        },

        onPanResponderRelease: (event, gestureState) => {
          if (!canScrub) {
            setIsScrubbing(false);
            return;
          }

          const nextX = dragStartXRef.current + gestureState.dx;
          const ratio = setProgressFromX(nextX);

          seekToProgress(ratio);

          setTimeout(() => {
            setIsScrubbing(false);
          }, 120);
        },

        onPanResponderTerminate: () => {
          setIsScrubbing(false);
        },
      }),
    [canScrub, seekToProgress, setIsScrubbing, setProgressFromX]
  );

  const safeProgress = clamp(progress, 0, 1);

  const thumbLeft = clamp(
    safeProgress * trackWidth - THUMB_SIZE / 2,
    0,
    Math.max(trackWidth - THUMB_SIZE, 0)
  );

  return {
    progress,
    duration,
    canScrub,
    safeProgress,
    thumbLeft,
    setTrackWidth,
    panHandlers: progressPanResponder.panHandlers,
    setProgress,
  };
}