import { useCallback, useEffect, useRef } from 'react';
import { findNodeHandle, UIManager } from 'react-native';

import { useOnboarding } from '../context/OnboardingContext';

export function useTourTarget(id) {
  const ref = useRef(null);
  const { registerTarget, unregisterTarget, isTourActive } = useOnboarding();

  const measureTarget = useCallback(() => {
    const node = findNodeHandle(ref.current);
    if (!node) return;

    UIManager.measureInWindow(node, (x, y, width, height) => {
      if (width > 0 && height > 0) {
        registerTarget(id, { x, y, width, height });
      }
    });
  }, [id, registerTarget]);

  useEffect(() => {
    if (!isTourActive) return undefined;

    const frame = requestAnimationFrame(measureTarget);
    const timer = setTimeout(measureTarget, 250);

    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(timer);
      unregisterTarget(id);
    };
  }, [id, isTourActive, measureTarget, unregisterTarget]);

  return { ref, onLayout: measureTarget };
}
