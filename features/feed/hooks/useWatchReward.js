import { useCallback, useEffect, useRef, useState } from 'react';
import { awardVideoPoints } from '../services/../../gamification/services/growPoints';

const WATCH_THRESHOLD = 0.8;

// Progress kommt ca. alle 150ms.
// Alles deutlich über 1.25s wirkt wie ein Sprung/Skip und zählt nicht als Watch-Time.
const MAX_NATURAL_PROGRESS_DELTA_SECONDS = 1.25;

export function useWatchReward({
  isActive,
  progress,
  duration,
  userId,
  videoId,
  isScrubbing = false,
}) {
  const [showPointReward, setShowPointReward] = useState(false);

  const hasAwardedPointsRef = useRef(false);
  const isAwardingPointsRef = useRef(false);

  const watchedSecondsRef = useRef(0);
  const lastVideoSecondRef = useRef(null);

  useEffect(() => {
    if (!isActive) {
      hasAwardedPointsRef.current = false;
      isAwardingPointsRef.current = false;
      watchedSecondsRef.current = 0;
      lastVideoSecondRef.current = null;
      setShowPointReward(false);
    }
  }, [isActive, videoId]);

  const awardVideoPointIfNeeded = useCallback(async () => {
    if (!userId) return;
    if (hasAwardedPointsRef.current) return;
    if (isAwardingPointsRef.current) return;

    isAwardingPointsRef.current = true;

    try {
      const result = await awardVideoPoints(userId, videoId);

      if (result?.reason === 'already_awarded') {
        hasAwardedPointsRef.current = true;
        return;
      }

      if (result?.awarded) {
        hasAwardedPointsRef.current = true;
        setShowPointReward(true);

        setTimeout(() => {
          setShowPointReward(false);
        }, 2200);
      }
    } catch (error) {
      console.log('Fehler bei Video-Grow-Points:', error);
    } finally {
      isAwardingPointsRef.current = false;
    }
  }, [userId, videoId]);

  useEffect(() => {
    if (!isActive) return;
    if (duration <= 0) return;
    if (hasAwardedPointsRef.current) return;

    const currentVideoSecond = progress * duration;

    if (isScrubbing) {
      lastVideoSecondRef.current = currentVideoSecond;
      return;
    }

    if (lastVideoSecondRef.current === null) {
      lastVideoSecondRef.current = currentVideoSecond;
      return;
    }

    const deltaSeconds = currentVideoSecond - lastVideoSecondRef.current;
    lastVideoSecondRef.current = currentVideoSecond;

    const isNaturalPlaybackDelta =
      deltaSeconds > 0 &&
      deltaSeconds <= MAX_NATURAL_PROGRESS_DELTA_SECONDS;

    if (isNaturalPlaybackDelta) {
      watchedSecondsRef.current += deltaSeconds;
    }

    const requiredWatchSeconds = duration * WATCH_THRESHOLD;

    if (watchedSecondsRef.current >= requiredWatchSeconds) {
      awardVideoPointIfNeeded();
    }
  }, [
    progress,
    duration,
    isActive,
    isScrubbing,
    awardVideoPointIfNeeded,
  ]);

  return {
    showPointReward,
  };
}