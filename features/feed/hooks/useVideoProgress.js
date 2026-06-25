import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PanResponder } from "react-native";
import { useEventListener } from "expo";
import { logVideoPlayerError } from "../utils/videoPlayerSafety";

const PROGRESS_UPDATE_INTERVAL = 150;
const THUMB_SIZE = 12;
const SCRUB_TOUCH_ZONE_MIN_Y = 70;
const SCRUB_TOUCH_ZONE_MAX_Y = 116;
const SCRUB_HORIZONTAL_MOVE_THRESHOLD = 5;

const clamp = (value, min, max) => {
  return Math.max(min, Math.min(value, max));
};

const formatVideoTime = (seconds) => {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return "0:00";
  }

  const totalSeconds = Math.floor(seconds);
  const minutes = Math.floor(totalSeconds / 60);
  const remainingSeconds = totalSeconds % 60;

  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
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
  const [currentTime, setCurrentTime] = useState(0);
  const [trackWidth, setTrackWidth] = useState(0);

  const dragStartXRef = useRef(0);
  const latestDurationRef = useRef(0);
  const latestScrubRatioRef = useRef(0);
  const liveSeekFrameRef = useRef(null);
  const finishScrubTimeoutRef = useRef(null);

  const canScrub = duration > 0 && trackWidth > 0;

  const updateProgressState = useCallback((nextCurrentTime, nextDuration) => {
    const safeDuration = Number.isFinite(nextDuration) ? nextDuration : 0;
    const safeCurrentTime = Number.isFinite(nextCurrentTime) ? nextCurrentTime : 0;

    latestDurationRef.current = safeDuration;
    setDuration(safeDuration);
    setCurrentTime(safeCurrentTime);

    if (safeDuration > 0) {
      setProgress(clamp(safeCurrentTime / safeDuration, 0, 1));
    } else {
      setProgress(0);
    }
  }, []);

  useEffect(() => {
    if (!player) {
      return;
    }

    try {
      player.timeUpdateEventInterval =
        isActive && isFeedFocused && !isScrubbing
          ? PROGRESS_UPDATE_INTERVAL / 1000
          : 0;
    } catch (error) {
      logVideoPlayerError(
        "Fehler beim Setzen des Video-Fortschritt-Intervalls:",
        error,
      );
    }
  }, [isActive, isFeedFocused, isScrubbing, player]);

  useEventListener(player, "sourceLoad", ({ duration: loadedDuration }) => {
    const safeDuration = Number.isFinite(loadedDuration) ? loadedDuration : 0;

    latestDurationRef.current = safeDuration;
    setDuration(safeDuration);

    if (safeDuration <= 0) {
      setProgress(0);
    }
  });

  useEventListener(player, "timeUpdate", ({ currentTime: eventCurrentTime }) => {
    if (!isActive || !isFeedFocused || isScrubbing) {
      return;
    }

    const nextDuration = latestDurationRef.current || player.duration || 0;
    updateProgressState(eventCurrentTime, nextDuration);
  });

  useEventListener(player, "statusChange", ({ status }) => {
    if (status !== "readyToPlay") {
      return;
    }

    const nextDuration = player.duration || latestDurationRef.current || 0;
    const nextCurrentTime = player.currentTime || 0;

    if (nextDuration > 0) {
      updateProgressState(nextCurrentTime, nextDuration);
    }
  });

  const seekToProgress = useCallback(
    (ratio) => {
      const total = latestDurationRef.current || duration;

      if (!player || !total || typeof ratio !== "number") {
        return;
      }

      const safeRatio = clamp(ratio, 0, 1);
      const nextTime = safeRatio * total;

      try {
        player.currentTime = nextTime;
        setCurrentTime(nextTime);
      } catch (error) {
        logVideoPlayerError("Fehler beim Springen im Video:", error);
      }
    },
    [duration, player],
  );

  const seekToProgressOnNextFrame = useCallback(
    (ratio) => {
      latestScrubRatioRef.current = ratio;

      if (liveSeekFrameRef.current) {
        return;
      }

      liveSeekFrameRef.current = requestAnimationFrame(() => {
        liveSeekFrameRef.current = null;
        seekToProgress(latestScrubRatioRef.current);
      });
    },
    [seekToProgress],
  );

  useEffect(() => {
    return () => {
      if (liveSeekFrameRef.current) {
        cancelAnimationFrame(liveSeekFrameRef.current);
        liveSeekFrameRef.current = null;
      }

      if (finishScrubTimeoutRef.current) {
        clearTimeout(finishScrubTimeoutRef.current);
        finishScrubTimeoutRef.current = null;
      }
    };
  }, []);

  const setProgressFromX = useCallback(
    (x) => {
      if (!canScrub) {
        return null;
      }

      const clampedX = clamp(x, 0, trackWidth);
      const ratio = clampedX / trackWidth;
      const total = latestDurationRef.current || duration;

      latestScrubRatioRef.current = ratio;
      setProgress(ratio);

      if (total > 0) {
        setCurrentTime(ratio * total);
      }

      return ratio;
    },
    [canScrub, duration, trackWidth],
  );

  const startScrubbing = useCallback(
    (x) => {
      if (!canScrub) {
        return;
      }

      onScrubStart?.();
      setIsScrubbing(true);

      dragStartXRef.current = x;

      const ratio = setProgressFromX(x);

      if (typeof ratio === "number") {
        seekToProgress(ratio);
      }
    },
    [canScrub, onScrubStart, seekToProgress, setIsScrubbing, setProgressFromX],
  );

  const finishScrubbing = useCallback(
    (ratio) => {
      if (liveSeekFrameRef.current) {
        cancelAnimationFrame(liveSeekFrameRef.current);
        liveSeekFrameRef.current = null;
      }

      if (finishScrubTimeoutRef.current) {
        clearTimeout(finishScrubTimeoutRef.current);
        finishScrubTimeoutRef.current = null;
      }

      if (typeof ratio === "number") {
        seekToProgress(ratio);
      }

      if (finishScrubTimeoutRef.current) {
        clearTimeout(finishScrubTimeoutRef.current);
      }

      finishScrubTimeoutRef.current = setTimeout(() => {
        finishScrubTimeoutRef.current = null;
        setIsScrubbing(false);
        onScrubEnd?.();
      }, 80);
    },
    [onScrubEnd, seekToProgress, setIsScrubbing],
  );

  const isInsideScrubTouchZone = useCallback((event) => {
    const locationY = event?.nativeEvent?.locationY;

    if (!Number.isFinite(locationY)) {
      return false;
    }

    return (
      locationY >= SCRUB_TOUCH_ZONE_MIN_Y &&
      locationY <= SCRUB_TOUCH_ZONE_MAX_Y
    );
  }, []);

  const shouldHandleScrubMove = useCallback(
    (event, gestureState) => {
      if (!canScrub || !isInsideScrubTouchZone(event)) {
        return false;
      }

      const dx = Math.abs(gestureState?.dx ?? 0);
      const dy = Math.abs(gestureState?.dy ?? 0);

      return dx >= SCRUB_HORIZONTAL_MOVE_THRESHOLD && dx > dy;
    },
    [canScrub, isInsideScrubTouchZone],
  );

  const progressPanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: (event) =>
          canScrub && isInsideScrubTouchZone(event),
        onStartShouldSetPanResponderCapture: () => false,

        onMoveShouldSetPanResponder: shouldHandleScrubMove,
        onMoveShouldSetPanResponderCapture: () => false,

        onPanResponderTerminationRequest: () => true,

        onPanResponderGrant: (event) => {
          startScrubbing(event.nativeEvent.locationX);
        },

        onPanResponderMove: (event, gestureState) => {
          if (!canScrub) {
            return;
          }

          const nextX = dragStartXRef.current + gestureState.dx;
          const ratio = setProgressFromX(nextX);

          if (typeof ratio === "number") {
            seekToProgressOnNextFrame(ratio);
          }
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
      isInsideScrubTouchZone,
      onScrubEnd,
      seekToProgressOnNextFrame,
      setIsScrubbing,
      setProgressFromX,
      shouldHandleScrubMove,
      startScrubbing,
    ],
  );

  const safeProgress = clamp(progress, 0, 1);

  const thumbLeft = clamp(
    safeProgress * trackWidth - THUMB_SIZE / 2,
    0,
    Math.max(trackWidth - THUMB_SIZE, 0),
  );

  return {
    progress,
    duration,
    currentTime,
    canScrub,
    safeProgress,
    thumbLeft,
    setTrackWidth,
    panHandlers: progressPanResponder.panHandlers,
    setProgress,
    currentTimeText: formatVideoTime(currentTime),
    durationText: formatVideoTime(duration),
  };
}
