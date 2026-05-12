import { useCallback, useEffect, useState } from 'react';
import { deleteRating, fetchRating, upsertRating } from '../services/ratings';

export const RATINGS = [
  { key: 'fire', emoji: '🔥' },
  { key: 'thumbs_up', emoji: '👍' },
  { key: 'neutral', emoji: '😐' },
  { key: 'thumbs_down', emoji: '👎' },
];

export function useVideoRating({ userId, videoId, isActive }) {
  const [activeRating, setActiveRating] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isActive || !userId || !videoId) return;

    let cancelled = false;

    async function load() {
      try {
        const rating = await fetchRating(userId, videoId);

        if (!cancelled) {
          setActiveRating(rating);
        }
      } catch (err) {
        console.log('Fehler beim Laden der Bewertung:', err);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [isActive, userId, videoId]);

  useEffect(() => {
    if (!isActive) {
      setActiveRating(null);
    }
  }, [isActive, videoId]);

  const rate = useCallback(
    async (ratingKey) => {
      if (!userId || !videoId || loading) return;

      const previousRating = activeRating;
      const shouldRemoveRating = previousRating === ratingKey;
      const nextRating = shouldRemoveRating ? null : ratingKey;

      setActiveRating(nextRating);
      setLoading(true);

      try {
        if (shouldRemoveRating) {
          await deleteRating(userId, videoId);
        } else {
          await upsertRating(userId, videoId, ratingKey);
        }
      } catch (err) {
        console.log('Fehler beim Speichern der Bewertung:', err);
        setActiveRating(previousRating);
      } finally {
        setLoading(false);
      }
    },
    [activeRating, userId, videoId, loading]
  );

  return { activeRating, rate };
}