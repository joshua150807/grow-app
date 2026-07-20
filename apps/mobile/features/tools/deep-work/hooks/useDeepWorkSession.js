import { logger } from '../../../../lib/logger';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, AppState } from 'react-native';
import { useAudioPlayer } from 'expo-audio';

import {
  saveDeepWorkSession,
  clearDeepWorkSession,
  getSavedDeepWorkSession,
  finalizeDeepWorkSession,
  claimLegacyDeepWorkData,
  addCompletedDeepWorkSession,
} from '../services/deepWorkStore';
import { createDeepWorkClientSessionId } from '../services/deepWorkClientId';
import { isDeepWorkSyncEnabled } from '../services/deepWorkSyncConfig';
import { triggerDeepWorkSyncForCurrentUser } from '../services/deepWorkSyncWorker';
import { supabase } from '../../../../services/supabaseClient';

import {
  DEFAULT_SESSION_MINUTES,
  EXAMPLE_CATEGORIES,
} from '../utils/deepWorkUtils';

const deepWorkDoneSound = require('../../../../assets/sounds/deepwork-done.mp3');

export function useDeepWorkSession() {
  const [phase, setPhase] = useState('idle');
  const [taskName, setTaskName] = useState('');
  const [category, setCategory] = useState('');
  const [totalMinutes, setTotalMinutes] = useState(60);
  const [remaining, setRemaining] = useState(0);
  const [endTimestamp, setEndTimestamp] = useState(null);
  const [appState, setAppState] = useState(AppState.currentState ?? 'active');

  const [setupVisible, setSetupVisible] = useState(false);
  const [inputTask, setInputTask] = useState('');
  const [selHours, setSelHours] = useState(0);
  const [selMinutes, setSelMinutes] = useState(DEFAULT_SESSION_MINUTES);
  const [selCategory, setSelCategory] = useState(EXAMPLE_CATEGORIES[0]);
  const [customCategory, setCustomCategory] = useState('');

  const [doneVisible, setDoneVisible] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [isEnding, setIsEnding] = useState(false);

  const intervalRef = useRef(null);
  const mountedRef = useRef(true);
  const startLockRef = useRef(false);
  const finalizationFlightRef = useRef(null);
  const completedRef = useRef(false);
  const latestSessionRef = useRef({
    phase: 'idle',
    remaining: 0,
    totalMinutes: 60,
    taskName: '',
    category: '',
    endTimestamp: null,
    ownerUserId: null,
    clientSessionId: null,
    startedAt: null,
    completionIntent: null,
  });
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const donePlayer = useAudioPlayer(deepWorkDoneSound);

  const getCurrentUserId = useCallback(async () => {
    if (!isDeepWorkSyncEnabled()) return null;
    const { data: { session } = {} } = await supabase.auth.getSession();
    return session?.user?.id || null;
  }, []);

  const assertCurrentOwner = useCallback(async (snapshot) => {
    if (!isDeepWorkSyncEnabled()) return null;
    const currentUserId = await getCurrentUserId();
    if ((snapshot?.ownerUserId || null) !== currentUserId) {
      const error = new Error('The active Deep Work session belongs to another user.');
      error.code = 'DEEP_WORK_SESSION_OWNER_MISMATCH';
      throw error;
    }
    return currentUserId;
  }, [getCurrentUserId]);

  const clearTicker = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const persistCurrentSession = useCallback(async (override = {}) => {
    const snapshot = {
      ...latestSessionRef.current,
      ...override,
    };

    if (snapshot.phase === 'idle') {
      if (isDeepWorkSyncEnabled()) {
        const currentUserId = await assertCurrentOwner(snapshot);
        await clearDeepWorkSession(currentUserId);
      } else {
        await clearDeepWorkSession();
      }
      return;
    }

    if (isDeepWorkSyncEnabled()) await assertCurrentOwner(snapshot);

    await saveDeepWorkSession({
      phase: snapshot.phase,
      remaining: Math.max(Number(snapshot.remaining) || 0, 0),
      totalSeconds: Math.max(Number(snapshot.totalMinutes) || 0, 0) * 60,
      taskName: snapshot.taskName || 'Deep Work',
      category: snapshot.category || 'Fokus',
      updatedAt: Date.now(),
      endTimestamp: snapshot.phase === 'running'
        ? snapshot.endTimestamp
        : null,
      ownerUserId: snapshot.ownerUserId,
      clientSessionId: snapshot.clientSessionId,
      startedAt: snapshot.startedAt,
      legacyClaimEligible: snapshot.legacyClaimEligible,
      completionIntent: snapshot.completionIntent,
    });
  }, [assertCurrentOwner]);

  const runFinalization = useCallback((snapshot, options) => {
    if (finalizationFlightRef.current) return finalizationFlightRef.current;
    const operation = (async () => {
      const expectedUserId = isDeepWorkSyncEnabled()
        ? await assertCurrentOwner(snapshot)
        : undefined;
      const result = await finalizeDeepWorkSession({
        session: snapshot,
        expectedUserId,
        ...options,
      });
      if (isDeepWorkSyncEnabled()) {
        triggerDeepWorkSyncForCurrentUser().catch((error) => {
          logger.debug('[DeepWorkSync] Immediate sync failed:', error?.code ?? 'UNKNOWN');
        });
      }
      return result;
    })();
    finalizationFlightRef.current = operation;
    operation.finally(() => {
      if (finalizationFlightRef.current === operation) finalizationFlightRef.current = null;
    }).catch(() => {});
    return operation;
  }, [assertCurrentOwner]);

  const playDoneSound = useCallback(() => {
    try {
      donePlayer.seekTo(0);
      donePlayer.play();
    } catch (e) {
      logger.debug('Fehler beim Abspielen des Deep-Work-Sounds:', e);
    }
  }, [donePlayer]);

  const restoreIntoState = useCallback((saved) => {
    setPhase(saved.phase || 'paused');
    setRemaining(saved.remaining || 0);
    setTotalMinutes(Math.ceil((saved.totalSeconds || saved.remaining || 0) / 60));
    setTaskName(saved.taskName || 'Deep Work');
    setCategory(saved.category || 'Fokus');
    setEndTimestamp(saved.phase === 'running' ? saved.endTimestamp : null);
    latestSessionRef.current = {
      phase: saved.phase || 'paused',
      remaining: saved.remaining || 0,
      totalMinutes: Math.ceil((saved.totalSeconds || saved.remaining || 0) / 60),
      taskName: saved.taskName || 'Deep Work',
      category: saved.category || 'Fokus',
      endTimestamp: saved.phase === 'running' ? saved.endTimestamp : null,
      ownerUserId: saved.ownerUserId || null,
      clientSessionId: saved.clientSessionId || null,
      startedAt: saved.startedAt || null,
      legacyClaimEligible: saved.legacyClaimEligible === true,
      completionIntent: saved.completionIntent || null,
    };
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    const restoreSession = async () => {
      try {
        if (isDeepWorkSyncEnabled()) {
          const currentUserId = await getCurrentUserId();
          if (currentUserId) {
            await claimLegacyDeepWorkData(currentUserId);
          }
          const saved = await getSavedDeepWorkSession(currentUserId);
          if (!mountedRef.current || !saved) return;
          restoreIntoState(saved);
          return;
        }
        const saved = await getSavedDeepWorkSession();

        if (!mountedRef.current || !saved) return;
        restoreIntoState(saved);
      } catch (e) {
        logger.debug('Fehler beim Wiederherstellen der Deep-Work-Session:', e);
      }
    };

    restoreSession();

    return () => {
      mountedRef.current = false;
      clearTicker();
    };
  }, [clearTicker, getCurrentUserId, restoreIntoState]);

  useEffect(() => {
    if (!isDeepWorkSyncEnabled()) return undefined;
    const { data: { subscription } = {} } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      const nextUserId = nextSession?.user?.id || null;
      const snapshot = latestSessionRef.current;
      if ((snapshot.ownerUserId || null) !== nextUserId) {
        clearTicker();
        latestSessionRef.current = {
          ...snapshot,
          phase: 'idle',
          remaining: 0,
          endTimestamp: null,
          ownerUserId: null,
          clientSessionId: null,
          completionIntent: null,
        };
        if (mountedRef.current) {
          setPhase('idle');
          setRemaining(0);
          setEndTimestamp(null);
        }
      }

      getSavedDeepWorkSession(nextUserId)
        .then((saved) => {
          if (mountedRef.current && saved) restoreIntoState(saved);
        })
        .catch((e) => {
          logger.debug('Deep-Work-Session konnte nach Auth-Wechsel nicht geladen werden:', e?.code ?? 'UNKNOWN');
        });
    });
    return () => subscription?.unsubscribe();
  }, [clearTicker, restoreIntoState]);

  useEffect(() => {
    latestSessionRef.current = {
      phase,
      remaining,
      totalMinutes,
      taskName,
      category,
      endTimestamp,
      ownerUserId: latestSessionRef.current.ownerUserId,
      clientSessionId: latestSessionRef.current.clientSessionId,
      startedAt: latestSessionRef.current.startedAt,
      legacyClaimEligible: latestSessionRef.current.legacyClaimEligible,
      completionIntent: latestSessionRef.current.completionIntent,
    };
  }, [phase, remaining, totalMinutes, taskName, category, endTimestamp]);

  useEffect(() => {
    if (phase === 'running') {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.08,
            duration: 900,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 900,
            useNativeDriver: true,
          }),
        ])
      );

      loop.start();

      return () => {
        loop.stop();
        pulseAnim.stopAnimation();
        pulseAnim.setValue(1);
      };
    } else {
      pulseAnim.stopAnimation();
      pulseAnim.setValue(1);
    }
  }, [phase, pulseAnim]);

  useEffect(() => {
    if (phase !== 'running' || appState !== 'active') {
      clearTicker();
      return;
    }

    clearTicker();

    const updateRemaining = () => {
      const left = Math.max(Math.ceil((endTimestamp - Date.now()) / 1000), 0);

      if (left <= 0) {
        clearTicker();

        const showCompletedState = () => {
          if (!mountedRef.current) return;
          setRemaining(0);
          setEndTimestamp(null);
          setPhase('idle');
          setDoneVisible(true);
        };

        if (!completedRef.current) {
          completedRef.current = true;
          const completedSeconds = totalMinutes * 60;

          playDoneSound();

          if (!isDeepWorkSyncEnabled()) {
            addCompletedDeepWorkSession(completedSeconds).catch((e) => {
              logger.debug('Fehler beim Speichern der Deep-Work-Historie:', e);
            });
            clearDeepWorkSession().catch((e) => {
              logger.debug('Fehler beim Löschen der Deep-Work-Session:', e);
            });
            showCompletedState();
          } else {
            runFinalization(latestSessionRef.current, {
              durationSeconds: completedSeconds,
              completedAt: new Date(endTimestamp).toISOString(),
              reason: 'natural',
            })
              .then(showCompletedState)
              .catch((e) => {
                completedRef.current = false;
                logger.debug('Fehler beim Speichern der Deep-Work-Historie:', e?.code ?? 'UNKNOWN');
              });
          }
        }
        return;
      }

      setRemaining(left);
    };

    updateRemaining();
    intervalRef.current = setInterval(updateRemaining, 1000);

    return clearTicker;
  }, [phase, appState, endTimestamp, totalMinutes, playDoneSound, clearTicker, runFinalization]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      setAppState(nextState);

      if (nextState === 'inactive' || nextState === 'background') {
        const snapshot = latestSessionRef.current;

        if (snapshot.phase === 'running' || snapshot.phase === 'paused') {
          const nextRemaining = snapshot.phase === 'running'
            ? Math.max(Math.ceil((snapshot.endTimestamp - Date.now()) / 1000), 0)
            : snapshot.remaining;

          persistCurrentSession({ remaining: nextRemaining }).catch((e) => {
            logger.debug('Fehler beim Zwischenspeichern der Deep-Work-Session:', e);
          });
        }
      } else if (nextState === 'active') {
        const snapshot = latestSessionRef.current;

        if (snapshot.phase === 'running') {
          const nextRemaining = Math.max(
            Math.ceil((snapshot.endTimestamp - Date.now()) / 1000),
            0
          );
          setRemaining(nextRemaining);
        }
      }
    });

    return () => subscription.remove();
  }, [persistCurrentSession]);

  const startSession = useCallback(async () => {
    if (startLockRef.current) return;

    const mins = selHours * 60 + selMinutes;
    if (mins <= 0) return;

    startLockRef.current = true;
    setIsStarting(true);

    const cat = customCategory.trim() || selCategory || 'Fokus';
    const seconds = mins * 60;
    const name = inputTask.trim() || 'Deep Work';
    const startedAtMs = Date.now();
    const sessionEndTimestamp = startedAtMs + seconds * 1000;
    let syncMetadata = {};

    if (isDeepWorkSyncEnabled()) {
      try {
        const ownerUserId = await getCurrentUserId();
        syncMetadata = {
          schemaVersion: 2,
          ownerUserId,
          clientSessionId: createDeepWorkClientSessionId(),
          startedAt: new Date(startedAtMs).toISOString(),
          legacyClaimEligible: false,
        };
      } catch (e) {
        logger.debug('Deep-Work-Sync-Nutzer konnte nicht geladen werden:', e?.code ?? 'UNKNOWN');
        syncMetadata = {
          schemaVersion: 2,
          ownerUserId: null,
          clientSessionId: createDeepWorkClientSessionId(),
          startedAt: new Date(startedAtMs).toISOString(),
          legacyClaimEligible: false,
        };
      }
    }

    try {
      await saveDeepWorkSession({
        phase: 'running',
        remaining: seconds,
        totalSeconds: seconds,
        taskName: name,
        category: cat,
        updatedAt: Date.now(),
        endTimestamp: sessionEndTimestamp,
        ...syncMetadata,
      });

      completedRef.current = false;

      if (!mountedRef.current) return;

      setTaskName(name);
      setCategory(cat);
      setTotalMinutes(mins);
      setRemaining(seconds);
      setEndTimestamp(sessionEndTimestamp);
      latestSessionRef.current = {
        phase: 'running',
        remaining: seconds,
        totalMinutes: mins,
        taskName: name,
        category: cat,
        endTimestamp: sessionEndTimestamp,
        ownerUserId: syncMetadata.ownerUserId || null,
        clientSessionId: syncMetadata.clientSessionId || null,
        startedAt: syncMetadata.startedAt || null,
        legacyClaimEligible: syncMetadata.legacyClaimEligible === true,
        completionIntent: null,
      };
      setSetupVisible(false);
      setPhase('running');
    } catch (e) {
      logger.debug('Fehler beim Starten der Deep-Work-Session:', e);
    } finally {
      startLockRef.current = false;
      if (mountedRef.current) {
        setIsStarting(false);
      }
    }
  }, [inputTask, selHours, selMinutes, selCategory, customCategory, getCurrentUserId]);

  const togglePause = useCallback(() => {
    const snapshot = latestSessionRef.current;
    if (snapshot.phase !== 'running' && snapshot.phase !== 'paused') return;

    const nextPhase = snapshot.phase === 'running' ? 'paused' : 'running';
    const nextRemaining = snapshot.phase === 'running'
      ? Math.max(Math.ceil((snapshot.endTimestamp - Date.now()) / 1000), 0)
      : snapshot.remaining;
    const nextEndTimestamp = nextPhase === 'running'
      ? Date.now() + nextRemaining * 1000
      : null;

    const applyToggle = () => {
      setRemaining(nextRemaining);
      setEndTimestamp(nextEndTimestamp);
      setPhase(nextPhase);

      persistCurrentSession({
        phase: nextPhase,
        remaining: nextRemaining,
        endTimestamp: nextEndTimestamp,
      }).catch((e) => {
        logger.debug('Fehler beim Speichern des Deep-Work-Pausenstatus:', e);
      });
    };

    if (!isDeepWorkSyncEnabled()) {
      applyToggle();
      return;
    }

    assertCurrentOwner(snapshot)
      .then(applyToggle)
      .catch((e) => {
        logger.debug('Deep-Work-Session darf nicht verändert werden:', e?.code ?? 'UNKNOWN');
      });
  }, [persistCurrentSession, assertCurrentOwner]);

  const endSession = useCallback(async () => {
    setIsEnding(true);
    clearTicker();

    const snapshot = latestSessionRef.current;
    const totalSeconds = snapshot.totalMinutes * 60;
    const currentRemaining = snapshot.phase === 'running'
      ? Math.max(Math.ceil((snapshot.endTimestamp - Date.now()) / 1000), 0)
      : snapshot.remaining;
    const completedSeconds = Math.max(totalSeconds - currentRemaining, 0);

    try {
      await runFinalization(snapshot, {
        durationSeconds: completedSeconds,
        completedAt: new Date().toISOString(),
        reason: 'manual',
      });

      if (!mountedRef.current) return;

      completedRef.current = false;
      setPhase('idle');
      setRemaining(0);
      setEndTimestamp(null);
    } catch (e) {
      logger.debug('Fehler beim Beenden der Deep-Work-Session:', e);
    } finally {
      if (mountedRef.current) {
        setIsEnding(false);
      }
    }
  }, [clearTicker, runFinalization]);

  const openSetup = useCallback(() => {
    setInputTask('');
    setSelHours(0);
    setSelMinutes(DEFAULT_SESSION_MINUTES);
    setSelCategory(EXAMPLE_CATEGORIES[0]);
    setCustomCategory('');
    setSetupVisible(true);
  }, []);

  const closeSetup = useCallback(() => {
    if (isStarting) return;
    setSetupVisible(false);
  }, [isStarting]);

  const closeDone = useCallback(() => {
    setDoneVisible(false);
  }, []);

  const progress = totalMinutes > 0
    ? 1 - remaining / (totalMinutes * 60)
    : 0;

  const canStart = selHours > 0 || selMinutes > 0;

  return {
    phase,
    taskName,
    category,
    totalMinutes,
    remaining,
    progress,
    canStart,
    pulseAnim,

    setupVisible,
    inputTask,
    selHours,
    selMinutes,
    selCategory,
    customCategory,

    doneVisible,
    isStarting,
    isEnding,

    setInputTask,
    setSelHours,
    setSelMinutes,
    setSelCategory,
    setCustomCategory,

    startSession,
    togglePause,
    endSession,
    openSetup,
    closeSetup,
    closeDone,
  };
}
