import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Pedometer } from 'expo-sensors';
import { upsertSteps } from '../services/steps';

function getLocalStartOfDay() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return start;
}

export function useSteps() {
  const [steps, setSteps] = useState(0);
  const [isAvailable, setIsAvailable] = useState(true);
  const [permissionStatus, setPermissionStatus] = useState('undetermined');
  const [error, setError] = useState(null);

  const mountedRef = useRef(true);
  const saveTimeoutRef = useRef(null);

  const fetchSteps = useCallback(async () => {
    try {
      setError(null);

      const available = await Pedometer.isAvailableAsync();

      if (!mountedRef.current) return;

      setIsAvailable(available);

      if (!available) {
        setSteps(0);
        setError('steps_not_available');
        return;
      }

      const permission = await Pedometer.getPermissionsAsync();

      if (!mountedRef.current) return;

      setPermissionStatus(permission.status);

      if (permission.status !== 'granted') {
        setSteps(0);
        setError('motion_permission_denied');
        return;
      }

      const startOfDay = getLocalStartOfDay();
      const now = new Date();

      const result = await Pedometer.getStepCountAsync(startOfDay, now);

      if (!mountedRef.current) return;

      const count = Number(result?.steps ?? 0);

      setSteps(count);

      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => {
        upsertSteps(count).catch(() => {});
      }, 3000);
    } catch (err) {
      if (!mountedRef.current) return;

      setError('steps_fetch_failed');
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    fetchSteps();

    const interval = setInterval(fetchSteps, 30000);

    const appStateSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        fetchSteps();
      }
    });

    return () => {
      mountedRef.current = false;
      clearInterval(interval);
      clearTimeout(saveTimeoutRef.current);
      appStateSub.remove();
    };
  }, [fetchSteps]);

  useFocusEffect(
    useCallback(() => {
      fetchSteps();
    }, [fetchSteps])
  );

  return {
    steps,
    isAvailable,
    permissionStatus,
    error,
    refreshSteps: fetchSteps,
  };
}