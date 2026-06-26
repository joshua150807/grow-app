import { useCallback, useEffect, useRef } from "react";
import { findNodeHandle, InteractionManager, Platform, StatusBar, UIManager, useWindowDimensions } from "react-native";
import { usePathname } from "expo-router";

import { useOnboarding } from "../context/OnboardingContext";

const ANDROID_EXTRA_TARGET_Y_OFFSET = 10;

const ANDROID_WINDOW_Y_CORRECTION =
  Platform.OS === "android"
    ? Math.min(StatusBar.currentHeight ?? 0, 32) + ANDROID_EXTRA_TARGET_Y_OFFSET
    : 0;

function normalizeTourRoute(route) {
  if (!route) return null;
  if (route === "/(tabs)") return "/";
  return route.replace(/\/\([^)]*\)/g, "") || "/";
}

export function useTourTarget(id) {
  const ref = useRef(null);
  const dimensions = useWindowDimensions();
  const pathname = usePathname();
  const { registerTarget, unregisterTarget, isTourActive, currentStepIndex, currentStep } =
    useOnboarding();

  const measureTarget = useCallback(() => {
    if (!id) return;

    const expectedPathname = normalizeTourRoute(currentStep?.route);
    if (expectedPathname && pathname !== expectedPathname) return;

    const node = findNodeHandle(ref.current);
    if (!node) return;

    UIManager.measureInWindow(node, (x, y, width, height) => {
      if (width > 0 && height > 0) {
        registerTarget(id, {
          x,
          y: y + ANDROID_WINDOW_Y_CORRECTION,
          width,
          height,
          measuredStepIndex: currentStepIndex,
          measuredStepId: currentStep?.id,
          measuredAt: Date.now(),
        });
      }
    });
  }, [currentStep?.id, currentStep?.route, currentStepIndex, id, pathname, registerTarget]);

  useEffect(() => {
    if (!isTourActive || !id) return undefined;

    const frame = requestAnimationFrame(measureTarget);
    const interactionTask = InteractionManager.runAfterInteractions(measureTarget);
    const timers = [80, 180, 360, 650, 1000].map((delay) =>
      setTimeout(measureTarget, delay),
    );

    return () => {
      cancelAnimationFrame(frame);
      interactionTask?.cancel?.();
      timers.forEach(clearTimeout);
      unregisterTarget(id);
    };
  }, [
    currentStep?.targetId,
    currentStepIndex,
    dimensions.height,
    dimensions.width,
    id,
    pathname,
    isTourActive,
    measureTarget,
    unregisterTarget,
  ]);

  return { ref, onLayout: measureTarget };
}
