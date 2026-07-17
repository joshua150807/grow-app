import { logger } from '../../../../lib/logger';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, AppState } from 'react-native';
import { useAudioPlayer } from 'expo-audio';

import {
  saveDeepWorkSession,
  clearDeepWorkSession,
  getSavedDeepWorkSession,
  addCompletedDeepWorkSession,
} from '../services/deepWorkStore';

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
  const endLockRef = useRef(false);
  const completedRef = useRef(false);
  const latestSessionRef = useRef({
    phase: 'idle',
    remaining: 0,
    totalMinutes: 60,
    taskName: '',
    category: '',
    endTimestamp: null,
  });
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const donePlayer = useAudioPlayer(deepWorkDoneSound);

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
      await clearDeepWorkSession();
      return;
    }

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
    });
  }, []);

  const playDoneSound = useCallback(() => {
    try {
      donePlayer.seekTo(0);
      donePlayer.play();
    } catch (e) {
      logger.debug('Fehler beim Abspielen des Deep-Work-Sounds:', e);
    }
  }, [donePlayer]);

  useEffect(() => {
    mountedRef.current = true;

    const restoreSession = async () => {
      try {
        const saved = await getSavedDeepWorkSession();

        if (!mountedRef.current || !saved) return;

        setPhase(saved.phase || 'paused');
        setRemaining(saved.remaining || 0);
        setTotalMinutes(Math.ceil((saved.totalSeconds || saved.remaining || 0) / 60));
        setTaskName(saved.taskName || 'Deep Work');
        setCategory(saved.category || 'Fokus');
        setEndTimestamp(saved.phase === 'running' ? saved.endTimestamp : null);
      } catch (e) {
        logger.debug('Fehler beim Wiederherstellen der Deep-Work-Session:', e);
      }
    };

    restoreSession();

    return () => {
      mountedRef.current = false;
      clearTicker();
    };
  }, [clearTicker]);

  useEffect(() => {
    latestSessionRef.current = {
      phase,
      remaining,
      totalMinutes,
      taskName,
      category,
      endTimestamp,
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

        if (!completedRef.current) {
          completedRef.current = true;
          const completedSeconds = totalMinutes * 60;

          playDoneSound();

          addCompletedDeepWorkSession(completedSeconds).catch((e) => {
            logger.debug('Fehler beim Speichern der Deep-Work-Historie:', e);
          });

          clearDeepWorkSession().catch((e) => {
            logger.debug('Fehler beim Löschen der Deep-Work-Session:', e);
          });
        }

        if (mountedRef.current) {
          setRemaining(0);
          setEndTimestamp(null);
          setPhase('idle');
          setDoneVisible(true);
        }
        return;
      }

      setRemaining(left);
    };

    updateRemaining();
    intervalRef.current = setInterval(updateRemaining, 1000);

    return clearTicker;
  }, [phase, appState, endTimestamp, totalMinutes, playDoneSound, clearTicker]);

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
    const sessionEndTimestamp = Date.now() + seconds * 1000;

    try {
      await saveDeepWorkSession({
        phase: 'running',
        remaining: seconds,
        totalSeconds: seconds,
        taskName: name,
        category: cat,
        updatedAt: Date.now(),
        endTimestamp: sessionEndTimestamp,
      });

      completedRef.current = false;

      if (!mountedRef.current) return;

      setTaskName(name);
      setCategory(cat);
      setTotalMinutes(mins);
      setRemaining(seconds);
      setEndTimestamp(sessionEndTimestamp);
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
  }, [inputTask, selHours, selMinutes, selCategory, customCategory]);

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
  }, [persistCurrentSession]);

  const endSession = useCallback(async () => {
    if (endLockRef.current) return;

    endLockRef.current = true;
    setIsEnding(true);
    clearTicker();

    const snapshot = latestSessionRef.current;
    const totalSeconds = snapshot.totalMinutes * 60;
    const currentRemaining = snapshot.phase === 'running'
      ? Math.max(Math.ceil((snapshot.endTimestamp - Date.now()) / 1000), 0)
      : snapshot.remaining;
    const completedSeconds = Math.max(totalSeconds - currentRemaining, 0);

    try {
      if (completedSeconds > 0) {
        await addCompletedDeepWorkSession(completedSeconds);
      }

      await clearDeepWorkSession();

      if (!mountedRef.current) return;

      completedRef.current = false;
      setPhase('idle');
      setRemaining(0);
      setEndTimestamp(null);
    } catch (e) {
      logger.debug('Fehler beim Beenden der Deep-Work-Session:', e);
    } finally {
      endLockRef.current = false;
      if (mountedRef.current) {
        setIsEnding(false);
      }
    }
  }, [clearTicker]);

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
