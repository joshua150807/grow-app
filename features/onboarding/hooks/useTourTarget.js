import { useCallback, useEffect, useRef } from "react";
import { findNodeHandle, UIManager } from "react-native";

import { useOnboarding } from "../context/OnboardingContext";

export function useTourTarget(id) {
  const ref = useRef(null);
  const { registerTarget, unregisterTarget, isTourActive, currentStepIndex } =
    useOnboarding();

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
    const timers = [120, 300, 550, 850].map((delay) =>
      setTimeout(measureTarget, delay),
    );

    return () => {
      cancelAnimationFrame(frame);
      timers.forEach(clearTimeout);
      unregisterTarget(id);
    };
  }, [currentStepIndex, id, isTourActive, measureTarget, unregisterTarget]);

  return { ref, onLayout: measureTarget };
}
