import { useCallback, useEffect, useMemo, useState } from 'react';

import { getPreloadedToolData, setPreloadedToolData } from '../../../../lib/preloadedTools';
import { getLeitfragenAnswers, upsertLeitfragenAnswer } from '../services/leitfragen';

export function useLeitfragenAnswers() {
  const preloadedAnswers = getPreloadedToolData('leitfragen_answers');

  const [answers, setAnswers] = useState(() => Array.isArray(preloadedAnswers) ? preloadedAnswers : []);
  const [loading, setLoading] = useState(!Array.isArray(preloadedAnswers));
  const [loadError, setLoadError] = useState(null);
  const [actionError, setActionError] = useState(null);

  const savePreloadedData = useCallback((nextAnswers) => {
    setPreloadedToolData('leitfragen_answers', nextAnswers);
  }, []);

  const loadAnswers = useCallback(async ({ silent = false } = {}) => {
    if (!silent) {
      setLoading(true);
    }
    setLoadError(null);

    try {
      const answersData = await getLeitfragenAnswers();
      setAnswers(answersData);
      savePreloadedData(answersData);
    } catch (e) {
      setLoadError('Leitfragen konnten nicht geladen werden.');
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, [savePreloadedData]);

  useEffect(() => {
    loadAnswers({ silent: Array.isArray(preloadedAnswers) });
  }, [loadAnswers]);

  const answersByKey = useMemo(() => {
    return answers.reduce((acc, entry) => {
      acc[entry.question_key] = entry;
      return acc;
    }, {});
  }, [answers]);

  const saveAnswer = useCallback(async ({ questionKey, answer }) => {
    const previousAnswers = answers;
    const now = new Date().toISOString();
    const optimisticAnswer = {
      id: `leitfragen-${questionKey}`,
      question_key: questionKey,
      answer,
      updated_at: now,
      created_at: now,
    };

    setAnswers(prev => {
      const exists = prev.some(entry => entry.question_key === questionKey);
      const nextAnswers = exists
        ? prev.map(entry => entry.question_key === questionKey ? { ...entry, answer, updated_at: now } : entry)
        : [...prev, optimisticAnswer];
      savePreloadedData(nextAnswers);
      return nextAnswers;
    });

    try {
      const savedAnswer = await upsertLeitfragenAnswer({ questionKey, answer });
      setAnswers(prev => {
        const exists = prev.some(entry => entry.question_key === questionKey);
        const nextAnswers = exists
          ? prev.map(entry => entry.question_key === questionKey ? savedAnswer : entry)
          : [...prev, savedAnswer];
        savePreloadedData(nextAnswers);
        return nextAnswers;
      });
    } catch (e) {
      setActionError('Leitfrage konnte nicht gespeichert werden.');
      setAnswers(previousAnswers);
      savePreloadedData(previousAnswers);
      throw e;
    }
  }, [answers, savePreloadedData]);

  return {
    answers,
    answersByKey,
    loading,
    loadError,
    actionError,
    setActionError,
    loadAnswers,
    saveAnswer,
  };
}
