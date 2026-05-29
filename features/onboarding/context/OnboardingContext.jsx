import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { router } from 'expo-router';

import { BASE_ONBOARDING_STEPS, FULL_ONBOARDING_STEPS } from '../data/onboardingSteps.js';
import {
  hasSeenOnboardingPrompt,
  markOnboardingPromptSeen,
  markTutorialFinished,
} from '../services/onboardingStorage';

const OnboardingContext = createContext(null);

export function useOnboarding() {
  const context = useContext(OnboardingContext);

  if (!context) {
    throw new Error('useOnboarding must be used inside OnboardingProvider');
  }

  return context;
}

export function OnboardingProvider({ children, isAuthenticated = false }) {
  const [isPromptVisible, setIsPromptVisible] = useState(false);
  const [isTourActive, setIsTourActive] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [targets, setTargets] = useState({});
  const [includeToolsTour, setIncludeToolsTour] = useState(false);
  const didCheckInitialPrompt = useRef(false);

  const activeSteps = includeToolsTour ? FULL_ONBOARDING_STEPS : BASE_ONBOARDING_STEPS;
  const currentStep = activeSteps[currentStepIndex] ?? activeSteps[0];
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === activeSteps.length - 1;

  useEffect(() => {
    if (!isAuthenticated) {
      didCheckInitialPrompt.current = false;
      setIsPromptVisible(false);
      setIsTourActive(false);
      setCurrentStepIndex(0);
      setIncludeToolsTour(false);
      return;
    }

    if (didCheckInitialPrompt.current) return;
    didCheckInitialPrompt.current = true;

    let cancelled = false;

    async function checkInitialPrompt() {
      try {
        const promptSeen = await hasSeenOnboardingPrompt();

        if (!cancelled && !promptSeen) {
          setIsPromptVisible(true);
        }
      } catch (err) {
        console.log('[Onboarding] Initiale Tutorial-Abfrage fehlgeschlagen:', err);
      }
    }

    checkInitialPrompt();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  const navigateToTourRoute = useCallback((route) => {
    if (!route) return;

    requestAnimationFrame(() => {
      router.navigate(route);
    });
  }, []);

  useEffect(() => {
    if (!isTourActive || !currentStep?.route) return;

    navigateToTourRoute(currentStep.route);
  }, [currentStep?.route, isTourActive, navigateToTourRoute]);

  const startTutorial = useCallback(async ({ fromPrompt = false } = {}) => {
    try {
      if (fromPrompt) {
        await markOnboardingPromptSeen();
        setIsPromptVisible(false);
      }

      setIncludeToolsTour(false);
      setCurrentStepIndex(0);
      setIsTourActive(true);
      navigateToTourRoute('/(tabs)');
    } catch (err) {
      console.log('[Onboarding] Tutorial konnte nicht gestartet werden:', err);
    }
  }, [navigateToTourRoute]);

  const declineInitialPrompt = useCallback(async () => {
    try {
      await markOnboardingPromptSeen();
      setIsPromptVisible(false);
    } catch (err) {
      console.log('[Onboarding] Tutorial-Abfrage konnte nicht gespeichert werden:', err);
      setIsPromptVisible(false);
    }
  }, []);

  const finishTutorial = useCallback(async () => {
    try {
      await markTutorialFinished();
    } catch (err) {
      console.log('[Onboarding] Tutorial-Abschluss konnte nicht gespeichert werden:', err);
    }

    setIsTourActive(false);
    setIncludeToolsTour(false);
    setCurrentStepIndex(0);
    navigateToTourRoute('/(tabs)');
  }, [navigateToTourRoute]);

  const skipTutorial = useCallback(() => {
    finishTutorial();
  }, [finishTutorial]);

  const startToolsExplanation = useCallback(() => {
    setIncludeToolsTour(true);
    setCurrentStepIndex(BASE_ONBOARDING_STEPS.length);
    navigateToTourRoute('/tools/all-tools');
  }, [navigateToTourRoute]);

  const goToNextStep = useCallback(() => {
    if (currentStep?.actionType === 'toolsChoice') {
      finishTutorial();
      return;
    }

    if (isLastStep) {
      finishTutorial();
      return;
    }

    setCurrentStepIndex((previous) => Math.min(previous + 1, activeSteps.length - 1));
  }, [activeSteps.length, currentStep?.actionType, finishTutorial, isLastStep]);

  const goToPreviousStep = useCallback(() => {
    setCurrentStepIndex((previous) => Math.max(previous - 1, 0));
  }, []);

  const registerTarget = useCallback((id, layout) => {
    if (!id || !layout) return;

    setTargets((previous) => ({
      ...previous,
      [id]: layout,
    }));
  }, []);

  const unregisterTarget = useCallback((id) => {
    if (!id) return;

    setTargets((previous) => {
      const next = { ...previous };
      delete next[id];
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({
      isPromptVisible,
      isTourActive,
      steps: activeSteps,
      currentStep,
      currentStepIndex,
      isFirstStep,
      isLastStep,
      targets,
      startTutorial,
      declineInitialPrompt,
      skipTutorial,
      finishTutorial,
      goToNextStep,
      goToPreviousStep,
      startToolsExplanation,
      registerTarget,
      unregisterTarget,
    }),
    [
      activeSteps,
      currentStep,
      currentStepIndex,
      declineInitialPrompt,
      finishTutorial,
      goToNextStep,
      goToPreviousStep,
      startToolsExplanation,
      isFirstStep,
      isLastStep,
      isPromptVisible,
      isTourActive,
      registerTarget,
      skipTutorial,
      startTutorial,
      targets,
      unregisterTarget,
    ]
  );

  return (
    <OnboardingContext.Provider value={value}>
      {children}
    </OnboardingContext.Provider>
  );
}
