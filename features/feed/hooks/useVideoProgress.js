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
  onScrubStart,
  onScrubEnd,
}) {
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [trackWidth, setTrackWidth] = useState(0);

  const dragStartXRef = useRef(0);
  const latestDurationRef = useRef(0);
  const latestScrubRatioRef = useRef(0);

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

      latestScrubRatioRef.current = ratio;
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

  const startScrubbing = useCallback(
    (x) => {
      if (!canScrub) return;

      onScrubStart?.();
      setIsScrubbing(true);

      dragStartXRef.current = x;

      const ratio = setProgressFromX(x);
      if (typeof ratio === 'number') {
        latestScrubRatioRef.current = ratio;
      }
    },
    [canScrub, onScrubStart, setIsScrubbing, setProgressFromX]
  );

  const finishScrubbing = useCallback(
    (ratio) => {
      if (typeof ratio === 'number') {
        seekToProgress(ratio);
      }

      setTimeout(() => {
        setIsScrubbing(false);
        onScrubEnd?.();
      }, 80);
    },
    [onScrubEnd, seekToProgress, setIsScrubbing]
  );

  const progressPanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => canScrub,
        onStartShouldSetPanResponderCapture: () => canScrub,

        onMoveShouldSetPanResponder: () => canScrub,
        onMoveShouldSetPanResponderCapture: () => canScrub,

        onPanResponderTerminationRequest: () => false,

        onPanResponderGrant: (event) => {
          startScrubbing(event.nativeEvent.locationX);
        },

        onPanResponderMove: (event, gestureState) => {
          if (!canScrub) return;

          const nextX = dragStartXRef.current + gestureState.dx;
          setProgressFromX(nextX);
        },

        onPanResponderRelease: (event, gestureState) => {
          if (!canScrub) {
            setIsScrubbing(false);
            onScrubEnd?.();
            return;
          }

          const nextX = dragStartXRef.current + gestureState.dx;
          const ratio = setProgressFromX(nextX);

          finishScrubbing(ratio);
        },

        onPanResponderTerminate: () => {
          finishScrubbing(latestScrubRatioRef.current);
        },
      }),
    [
      canScrub,
      finishScrubbing,
      onScrubEnd,
      setIsScrubbing,
      setProgressFromX,
      startScrubbing,
    ]
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