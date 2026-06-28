import { useCallback, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { getPreloadedToolData, setPreloadedToolData } from '../../../../lib/preloadedTools';
import { getCurrentUserId } from '../../../../services/authUser';
import { getLeitfragenAnswers, upsertLeitfragenAnswer } from '../services/leitfragen';

const PRELOADED_KEY = 'leitfragen_answers';
const LEITFRAGEN_CACHE_KEY = '@grow/leitfragen_answers:v1';

function normalizeAnswerEntry(entry) {
  if (!entry || typeof entry.question_key !== 'string') return null;

  return {
    id: entry.id || `leitfragen-${entry.question_key}`,
    question_key: entry.question_key,
    answer: typeof entry.answer === 'string' ? entry.answer : '',
    created_at: entry.created_at || new Date().toISOString(),
    updated_at: entry.updated_at || entry.local_updated_at || new Date().toISOString(),
    ...(entry.user_id ? { user_id: entry.user_id } : {}),
    ...(entry.sync_status === 'pending' ? { sync_status: 'pending' } : {}),
    ...(entry.local_updated_at ? { local_updated_at: entry.local_updated_at } : {}),
  };
}

function normalizeAnswers(answers) {
  if (!Array.isArray(answers)) return [];

  return answers
    .map(normalizeAnswerEntry)
    .filter(Boolean);
}

function upsertAnswerEntry(answers, nextEntry) {
  const safeEntry = normalizeAnswerEntry(nextEntry);
  if (!safeEntry) return normalizeAnswers(answers);

  const currentAnswers = normalizeAnswers(answers);
  const exists = currentAnswers.some(entry => entry.question_key === safeEntry.question_key);

  if (!exists) {
    return [...currentAnswers, safeEntry];
  }

  return currentAnswers.map(entry => (
    entry.question_key === safeEntry.question_key ? safeEntry : entry
  ));
}

function mergeRemoteWithLocalPending(remoteAnswers, localAnswers) {
  const mergedMap = new Map();

  normalizeAnswers(remoteAnswers).forEach(entry => {
    mergedMap.set(entry.question_key, entry);
  });

  normalizeAnswers(localAnswers)
    .filter(entry => entry.sync_status === 'pending')
    .forEach(entry => {
      mergedMap.set(entry.question_key, entry);
    });

  return Array.from(mergedMap.values());
}

async function getUserCacheKey() {
  try {
    const userId = await getCurrentUserId();
    return userId ? `${LEITFRAGEN_CACHE_KEY}:${userId}` : null;
  } catch {
    return null;
  }
}

async function readCachedAnswers() {
  const userCacheKey = await getUserCacheKey();
  const cacheKeys = [...new Set([userCacheKey, LEITFRAGEN_CACHE_KEY].filter(Boolean))];

  for (const cacheKey of cacheKeys) {
    try {
      const rawValue = await AsyncStorage.getItem(cacheKey);
      if (!rawValue) continue;

      const parsedValue = JSON.parse(rawValue);
      const cachedAnswers = normalizeAnswers(parsedValue);

      if (cachedAnswers.length > 0) {
        return cachedAnswers;
      }
    } catch {
      // Kaputten Cache ignorieren und Supabase/anderen Cache versuchen.
    }
  }

  return [];
}

async function writeCachedAnswers(answers) {
  const normalizedAnswers = normalizeAnswers(answers);
  const payload = JSON.stringify(normalizedAnswers);
  const userCacheKey = await getUserCacheKey();
  const cacheKeys = [...new Set([LEITFRAGEN_CACHE_KEY, userCacheKey].filter(Boolean))];

  await Promise.all(
    cacheKeys.map(cacheKey => AsyncStorage.setItem(cacheKey, payload))
  );

  return normalizedAnswers;
}

export function useLeitfragenAnswers() {
  const preloadedAnswers = getPreloadedToolData(PRELOADED_KEY);

  const [answers, setAnswers] = useState(() => normalizeAnswers(preloadedAnswers));
  const [loading, setLoading] = useState(!Array.isArray(preloadedAnswers));
  const [loadError, setLoadError] = useState(null);
  const [actionError, setActionError] = useState(null);

  const savePreloadedData = useCallback((nextAnswers) => {
    const normalizedAnswers = normalizeAnswers(nextAnswers);
    setPreloadedToolData(PRELOADED_KEY, normalizedAnswers);
    return normalizedAnswers;
  }, []);

  const saveLocalData = useCallback(async (nextAnswers) => {
    const normalizedAnswers = savePreloadedData(nextAnswers);

    try {
      await writeCachedAnswers(normalizedAnswers);
    } catch {
      // AsyncStorage darf die UI nicht blockieren.
    }

    return normalizedAnswers;
  }, [savePreloadedData]);

  const syncPendingAnswers = useCallback(async (currentAnswers) => {
    const pendingAnswers = normalizeAnswers(currentAnswers)
      .filter(entry => entry.sync_status === 'pending');

    if (pendingAnswers.length === 0) return;

    let nextAnswers = normalizeAnswers(currentAnswers);
    let failedSync = false;

    for (const pendingAnswer of pendingAnswers) {
      try {
        const savedAnswer = await upsertLeitfragenAnswer({
          questionKey: pendingAnswer.question_key,
          answer: pendingAnswer.answer,
        });

        nextAnswers = upsertAnswerEntry(nextAnswers, savedAnswer);
        setAnswers(nextAnswers);
        await saveLocalData(nextAnswers);
      } catch {
        failedSync = true;
      }
    }

    if (failedSync) {
      setActionError('Einige Leitfragen sind lokal gespeichert und werden später online synchronisiert.');
    }
  }, [saveLocalData]);

  const loadAnswers = useCallback(async ({ silent = false } = {}) => {
    if (!silent) {
      setLoading(true);
    }

    setLoadError(null);

    let cachedAnswers = [];

    try {
      cachedAnswers = await readCachedAnswers();

      if (cachedAnswers.length > 0) {
        setAnswers(cachedAnswers);
        savePreloadedData(cachedAnswers);

        if (!silent) {
          setLoading(false);
        }
      }
    } catch {
      // Cache-Fehler ignorieren, Supabase ist weiterhin die Quelle für Online-Daten.
    }

    try {
      const remoteAnswers = normalizeAnswers(await getLeitfragenAnswers());
      const mergedAnswers = mergeRemoteWithLocalPending(remoteAnswers, cachedAnswers);

      setAnswers(mergedAnswers);
      await saveLocalData(mergedAnswers);

      void syncPendingAnswers(mergedAnswers);
    } catch {
      if (cachedAnswers.length === 0) {
        setLoadError('Leitfragen konnten nicht geladen werden.');
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, [saveLocalData, savePreloadedData, syncPendingAnswers]);

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
    const now = new Date().toISOString();
    const optimisticAnswer = {
      id: `leitfragen-${questionKey}`,
      question_key: questionKey,
      answer,
      created_at: now,
      updated_at: now,
      local_updated_at: now,
      sync_status: 'pending',
    };

    let optimisticAnswers = [];

    setAnswers(prev => {
      optimisticAnswers = upsertAnswerEntry(prev, optimisticAnswer);
      savePreloadedData(optimisticAnswers);
      void writeCachedAnswers(optimisticAnswers);
      return optimisticAnswers;
    });

    try {
      const savedAnswer = await upsertLeitfragenAnswer({ questionKey, answer });

      setAnswers(prev => {
        const nextAnswers = upsertAnswerEntry(prev, savedAnswer);
        savePreloadedData(nextAnswers);
        void writeCachedAnswers(nextAnswers);
        return nextAnswers;
      });

      setActionError(null);
    } catch {
      setActionError('Antwort wurde lokal gespeichert und wird später online synchronisiert.');
    }
  }, [savePreloadedData]);

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
