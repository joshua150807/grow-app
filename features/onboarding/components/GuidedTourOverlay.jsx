import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { COLORS } from '../../../constants/colors';
import { s, sv, sf, SCREEN } from '../../../constants/layout';
import { useOnboarding } from '../context/OnboardingContext';

const BUBBLE_MARGIN = s(16);
const BUBBLE_MAX_WIDTH = Math.min(SCREEN.width - BUBBLE_MARGIN * 2, s(344));
const ESTIMATED_BUBBLE_HEIGHT = sv(224);
const TARGET_GAP = sv(18);
const ARROW_SIZE = s(16);

function clamp(value, min, max) {
  return Math.max(min, Math.min(value, max));
}

function getBubbleLayout(targetRect) {
  if (!targetRect) {
    return {
      bubbleStyle: {
        left: BUBBLE_MARGIN,
        width: SCREEN.width - BUBBLE_MARGIN * 2,
        top: clamp(SCREEN.height * 0.54, sv(120), SCREEN.height - ESTIMATED_BUBBLE_HEIGHT - sv(34)),
      },
      arrowStyle: null,
      arrowDirection: null,
    };
  }

  const targetCenterX = targetRect.x + targetRect.width / 2;
  const targetCenterY = targetRect.y + targetRect.height / 2;
  const shouldShowBelow = targetCenterY < SCREEN.height * 0.5;

  const bubbleWidth = BUBBLE_MAX_WIDTH;
  const bubbleLeft = clamp(
    targetCenterX - bubbleWidth / 2,
    BUBBLE_MARGIN,
    SCREEN.width - bubbleWidth - BUBBLE_MARGIN
  );

  const preferredTop = shouldShowBelow
    ? targetRect.y + targetRect.height + TARGET_GAP
    : targetRect.y - ESTIMATED_BUBBLE_HEIGHT - TARGET_GAP;

  const bubbleTop = clamp(
    preferredTop,
    sv(52),
    SCREEN.height - ESTIMATED_BUBBLE_HEIGHT - sv(28)
  );

  const arrowLeft = clamp(
    targetCenterX - bubbleLeft - ARROW_SIZE,
    s(26),
    bubbleWidth - s(26) - ARROW_SIZE * 2
  );

  return {
    bubbleStyle: {
      left: bubbleLeft,
      width: bubbleWidth,
      top: bubbleTop,
    },
    arrowStyle: {
      left: arrowLeft,
    },
    arrowDirection: shouldShowBelow ? 'up' : 'down',
  };
}

export default function GuidedTourOverlay() {
  const {
    isTourActive,
    steps,
    currentStep,
    currentStepIndex,
    targets,
    skipTutorial,
    goToNextStep,
    goToPreviousStep,
    startToolsExplanation,
  } = useOnboarding();

  const requestedTargetRect = currentStep?.targetId ? targets[currentStep.targetId] : null;
  const isRequestedStepReady = Boolean(currentStep) && (!currentStep.targetId || requestedTargetRect);

  const [visibleStepState, setVisibleStepState] = useState({
    step: null,
    index: 0,
    targetRect: null,
  });

  useEffect(() => {
    if (!isTourActive || !currentStep) {
      setVisibleStepState({ step: null, index: 0, targetRect: null });
      return;
    }

    // Wichtig: Beim Step-Wechsel nicht sofort Text/Box wechseln.
    // Erst warten, bis der neue Zielbereich wirklich gemessen wurde.
    // So bleibt der alte Step stabil sichtbar, während Route/ScrollView wechseln.
    if (!isRequestedStepReady) return;

    const nextTargetRect = currentStep.targetId ? requestedTargetRect : null;

    setVisibleStepState((previous) => {
      const sameStep = previous.step?.id === currentStep.id && previous.index === currentStepIndex;
      const sameRect =
        !nextTargetRect && !previous.targetRect
          ? true
          : Boolean(nextTargetRect && previous.targetRect) &&
            Math.abs(nextTargetRect.x - previous.targetRect.x) < 1 &&
            Math.abs(nextTargetRect.y - previous.targetRect.y) < 1 &&
            Math.abs(nextTargetRect.width - previous.targetRect.width) < 1 &&
            Math.abs(nextTargetRect.height - previous.targetRect.height) < 1;

      if (sameStep && sameRect) return previous;

      return {
        step: currentStep,
        index: currentStepIndex,
        targetRect: nextTargetRect,
      };
    });
  }, [currentStep, currentStepIndex, isRequestedStepReady, isTourActive, requestedTargetRect]);

  useEffect(() => {
    if (!isTourActive || !visibleStepState.step?.targetId) return;

    const freshRect = targets[visibleStepState.step.targetId];
    if (!freshRect) return;

    setVisibleStepState((previous) => {
      if (!previous.step || previous.step.id !== visibleStepState.step.id) return previous;

      const sameRect =
        previous.targetRect &&
        Math.abs(freshRect.x - previous.targetRect.x) < 1 &&
        Math.abs(freshRect.y - previous.targetRect.y) < 1 &&
        Math.abs(freshRect.width - previous.targetRect.width) < 1 &&
        Math.abs(freshRect.height - previous.targetRect.height) < 1;

      if (sameRect) return previous;

      return {
        ...previous,
        targetRect: freshRect,
      };
    });
  }, [isTourActive, targets, visibleStepState.step]);

  const visibleStep = visibleStepState.step ?? currentStep;
  const visibleStepIndex = visibleStepState.step ? visibleStepState.index : currentStepIndex;
  const targetRect = visibleStep?.targetId ? visibleStepState.targetRect : null;

  const { bubbleStyle, arrowStyle, arrowDirection } = useMemo(
    () => getBubbleLayout(targetRect),
    [targetRect]
  );

  const progressLabel = `${visibleStepIndex + 1} von ${steps.length}`;
  const isToolsChoiceStep = visibleStep?.actionType === 'toolsChoice';
  const isVisibleFirstStep = visibleStepIndex === 0;
  const isVisibleLastStep = visibleStepIndex === steps.length - 1;
  const isStepChanging = visibleStep?.id !== currentStep?.id || visibleStepIndex !== currentStepIndex;

  if (!isTourActive || !visibleStep) return null;

  return (
    <View style={styles.root} pointerEvents="auto">
      {targetRect && (
        <View
          pointerEvents="none"
          style={[
            styles.highlight,
            {
              left: targetRect.x - s(8),
              top: targetRect.y - sv(8),
              width: targetRect.width + s(16),
              height: targetRect.height + sv(16),
            },
          ]}
        />
      )}

      <View style={[styles.bubble, bubbleStyle]}>
        {arrowDirection && (
          <View
            pointerEvents="none"
            style={[
              styles.arrow,
              arrowStyle,
              arrowDirection === 'up' ? styles.arrowUp : styles.arrowDown,
            ]}
          />
        )}
        <View style={styles.topRow}>
          <Text style={styles.eyebrow}>{visibleStep.eyebrow}</Text>
          <Text style={styles.progress}>{progressLabel}</Text>
        </View>

        <Text style={styles.title}>{visibleStep.title}</Text>
        <Text style={styles.text}>{visibleStep.text}</Text>

        {isToolsChoiceStep ? (
          <View style={styles.choiceFooter}>
            <Pressable
              style={[styles.choiceSecondaryButton, isStepChanging && styles.disabledButton]}
              onPress={goToNextStep}
              disabled={isStepChanging}
            >
              <Text style={styles.choiceSecondaryText}>{visibleStep.primaryLabel ?? 'Loslegen'}</Text>
            </Pressable>

            <Pressable
              style={[styles.choicePrimaryButton, isStepChanging && styles.disabledButton]}
              onPress={startToolsExplanation}
              disabled={isStepChanging}
            >
              <Text style={styles.choicePrimaryText}>{visibleStep.secondaryLabel ?? 'Tools erklären'}</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.footerRow}>
            <Pressable style={styles.skipButton} onPress={skipTutorial}>
              <Text style={styles.skipText}>Überspringen</Text>
            </Pressable>

            <View style={styles.actionRow}>
              {!isVisibleFirstStep && (
                <Pressable
                  style={[styles.backButton, isStepChanging && styles.disabledButton]}
                  onPress={goToPreviousStep}
                  disabled={isStepChanging}
                >
                  <Feather name="chevron-left" size={s(18)} color={COLORS.toolsText} />
                </Pressable>
              )}

              <Pressable
                style={[styles.nextButton, isStepChanging && styles.disabledButton]}
                onPress={goToNextStep}
                disabled={isStepChanging}
              >
                <Text style={styles.nextButtonText}>
                  {isVisibleLastStep ? 'Loslegen' : visibleStep.primaryLabel ?? 'Weiter'}
                </Text>
              </Pressable>
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10000,
    elevation: 10000,
  },
  highlight: {
    position: 'absolute',
    borderRadius: s(18),
    borderWidth: 2,
    borderColor: COLORS.toolsGold,
    backgroundColor: 'rgba(231,201,138,0.08)',
    shadowColor: COLORS.toolsGold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.85,
    shadowRadius: 16,
    elevation: 14,
  },
  bubble: {
    position: 'absolute',
    borderRadius: s(22),
    borderWidth: 1,
    borderColor: 'rgba(231,201,138,0.28)',
    backgroundColor: '#0B080E',
    paddingHorizontal: s(18),
    paddingTop: sv(17),
    paddingBottom: sv(15),
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.32,
    shadowRadius: 22,
    elevation: 18,
  },
  arrow: {
    position: 'absolute',
    width: 0,
    height: 0,
    borderLeftWidth: ARROW_SIZE,
    borderRightWidth: ARROW_SIZE,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    shadowColor: COLORS.toolsGold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.95,
    shadowRadius: 10,
    elevation: 28,
  },
  arrowUp: {
    top: -ARROW_SIZE,
    borderBottomWidth: ARROW_SIZE,
    borderBottomColor: COLORS.toolsGold,
  },
  arrowDown: {
    bottom: -ARROW_SIZE,
    borderTopWidth: ARROW_SIZE,
    borderTopColor: COLORS.toolsGold,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: sv(8),
  },
  eyebrow: {
    color: COLORS.toolsGold,
    fontSize: sf(10),
    fontWeight: '800',
    letterSpacing: 1.8,
    textTransform: 'uppercase',
  },
  progress: {
    color: 'rgba(255,241,210,0.48)',
    fontSize: sf(12),
    fontWeight: '600',
  },
  title: {
    color: COLORS.toolsText,
    fontSize: sf(20),
    lineHeight: sf(25),
    fontWeight: '800',
    marginBottom: sv(7),
  },
  text: {
    color: 'rgba(255,241,210,0.70)',
    fontSize: sf(14),
    lineHeight: sf(20),
    marginBottom: sv(16),
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: s(12),
  },
  skipButton: {
    paddingVertical: sv(10),
    paddingRight: s(10),
  },
  skipText: {
    color: 'rgba(255,241,210,0.54)',
    fontSize: sf(13),
    fontWeight: '700',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(10),
  },
  backButton: {
    width: s(42),
    height: s(42),
    borderRadius: s(21),
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,241,210,0.14)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  nextButton: {
    minWidth: s(94),
    height: s(42),
    borderRadius: s(21),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.toolsGold,
    paddingHorizontal: s(18),
  },
  nextButtonText: {
    color: '#16100A',
    fontSize: sf(14),
    fontWeight: '900',
  },
  disabledButton: {
    opacity: 0.65,
  },
  choiceFooter: {
    gap: sv(10),
  },
  choicePrimaryButton: {
    height: sv(44),
    borderRadius: s(22),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.toolsGold,
  },
  choicePrimaryText: {
    color: '#16100A',
    fontSize: sf(14),
    fontWeight: '900',
  },
  choiceSecondaryButton: {
    height: sv(42),
    borderRadius: s(21),
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,241,210,0.16)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  choiceSecondaryText: {
    color: COLORS.toolsText,
    fontSize: sf(14),
    fontWeight: '800',
  },
});
