import { useCallback, useEffect, useRef, useState } from "react";
import { deleteRating, fetchRating, upsertRating } from "../services/ratings";
import { RATING_ICONS } from "../../../constants/ratingAssets";

export const RATINGS = [
  { key: "fire", icon: RATING_ICONS.fire },
  { key: "thumbs_up", icon: RATING_ICONS.thumbsUp },
  { key: "neutral", icon: RATING_ICONS.neutral },
  { key: "thumbs_down", icon: RATING_ICONS.thumbsDown },
];

export function useVideoRating({ userId, videoId, isActive }) {
  const [activeRating, setActiveRating] = useState(null);
  const [loading, setLoading] = useState(false);

  const isMountedRef = useRef(true);
  const requestIdRef = useRef(0);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!isActive || !userId || !videoId) return;

    let cancelled = false;
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    async function load() {
      try {
        const rating = await fetchRating(userId, videoId);

        if (
          !cancelled &&
          isMountedRef.current &&
          requestIdRef.current === requestId
        ) {
          setActiveRating(rating);
        }
      } catch (err) {
        console.log("Fehler beim Laden der Bewertung:", err);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [isActive, userId, videoId]);

  useEffect(() => {
    if (!isActive) {
      setLoading(false);
    }
  }, [isActive]);

  const rate = useCallback(
    async (ratingKey) => {
      if (!userId || !videoId) return;

      const previousRating = activeRating;
      const shouldClearRating = ratingKey === null;
      const nextRating = shouldClearRating ? null : ratingKey;

      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;

      setActiveRating(nextRating);
      setLoading(true);

      try {
        if (shouldClearRating) {
          await deleteRating(userId, videoId);
        } else {
          await upsertRating(userId, videoId, ratingKey);
        }
      } catch (err) {
        console.log("Fehler beim Speichern der Bewertung:", err);

        if (
          isMountedRef.current &&
          requestIdRef.current === requestId
        ) {
          setActiveRating(previousRating);
        }
      } finally {
        if (
          isMountedRef.current &&
          requestIdRef.current === requestId
        ) {
          setLoading(false);
        }
      }
    },
    [activeRating, userId, videoId],
  );

  return { activeRating, rate, loading };
}