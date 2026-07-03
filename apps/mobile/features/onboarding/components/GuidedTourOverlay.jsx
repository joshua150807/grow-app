import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';

import { COLORS } from '../../../constants/colors';
import { s, sv, sf } from '../../../constants/layout';
import { useOnboarding } from '../context/OnboardingContext';

const BUBBLE_MARGIN = s(16);
const ESTIMATED_BUBBLE_HEIGHT = sv(224);
const TARGET_GAP = sv(18);
const ARROW_SIZE = s(16);
const SCREEN_EDGE_GAP = s(6);

function clamp(value, min, max) {
  if (max < min) return min;
  return Math.max(min, Math.min(value, max));
}

function getHighlightLayout(targetRect, dimensions) {
  if (!targetRect) return null;

  const horizontalPadding = clamp(targetRect.width * 0.045, s(6), s(14));
  const verticalPadding = clamp(targetRect.height * 0.045, sv(6), sv(14));

  const rawLeft = targetRect.x - horizontalPadding;
  const rawTop = targetRect.y - verticalPadding;
  const rawRight = targetRect.x + targetRect.width + horizontalPadding;
  const rawBottom = targetRect.y + targetRect.height + verticalPadding;

  const left = clamp(rawLeft, SCREEN_EDGE_GAP, dimensions.width - SCREEN_EDGE_GAP);
  const top = clamp(rawTop, SCREEN_EDGE_GAP, dimensions.height - SCREEN_EDGE_GAP);
  const right = clamp(rawRight, left + s(12), dimensions.width - SCREEN_EDGE_GAP);
  const bottom = clamp(rawBottom, top + sv(12), dimensions.height - SCREEN_EDGE_GAP);

  return {
    left,
    top,
    width: right - left,
    height: bottom - top,
    borderRadius: clamp(Math.min(right - left, bottom - top) * 0.12, s(14), s(24)),
  };
}

function getBubbleLayout(targetRect, dimensions, insets) {
  const safeTop = Math.max(insets.top + sv(10), sv(34));
  const safeBottom = Math.max(insets.bottom + sv(18), sv(28));
  const availableWidth = Math.max(dimensions.width - BUBBLE_MARGIN * 2, s(260));
  const bubbleWidth = Math.min(availableWidth, s(344));

  if (!targetRect) {
    return {
      bubbleStyle: {
        left: Math.max(BUBBLE_MARGIN, (dimensions.width - bubbleWidth) / 2),
        width: bubbleWidth,
        top: clamp(
          dimensions.height * 0.54,
          safeTop,
          dimensions.height - ESTIMATED_BUBBLE_HEIGHT - safeBottom
        ),
      },
      arrowStyle: null,
      arrowDirection: null,
    };
  }

  const targetCenterX = targetRect.x + targetRect.width / 2;
  const spaceAbove = targetRect.y - safeTop;
  const spaceBelow = dimensions.height - (targetRect.y + targetRect.height) - safeBottom;
  const shouldShowBelow = spaceBelow >= ESTIMATED_BUBBLE_HEIGHT || spaceBelow >= spaceAbove;

  const bubbleLeft = clamp(
    targetCenterX - bubbleWidth / 2,
    BUBBLE_MARGIN,
    dimensions.width - bubbleWidth - BUBBLE_MARGIN
  );

  const preferredTop = shouldShowBelow
    ? targetRect.y + targetRect.height + TARGET_GAP
    : targetRect.y - ESTIMATED_BUBBLE_HEIGHT - TARGET_GAP;

  const bubbleTop = clamp(
    preferredTop,
    safeTop,
    dimensions.height - ESTIMATED_BUBBLE_HEIGHT - safeBottom
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
  const dimensions = useWindowDimensions();
  const insets = useSafeAreaInsets();

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

  const currentTargetRect = currentStep?.targetId ? targets[currentStep.targetId] : null;
  const requestedTargetRect =
    currentTargetRect?.measuredStepIndex === currentStepIndex &&
    currentTargetRect?.measuredStepId === currentStep?.id
      ? currentTargetRect
      : null;
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

    // Wichtig: Beim Step-/Seitenwechsel den alten Rahmen nicht weiter anzeigen.
    // Erst wieder einblenden, wenn der neue Zielbereich auf der neuen Seite gemessen wurde.
    if (!isRequestedStepReady) {
      setVisibleStepState({ step: null, index: currentStepIndex, targetRect: null });
      return;
    }

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
    if (
      !freshRect ||
      freshRect.measuredStepIndex !== visibleStepState.index ||
      freshRect.measuredStepId !== visibleStepState.step.id
    ) {
      return;
    }

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
  }, [isTourActive, targets, visibleStepState.index, visibleStepState.step]);

  const visibleStep = visibleStepState.step;
  const visibleStepIndex = visibleStepState.index;
  const targetRect = visibleStep?.targetId ? visibleStepState.targetRect : null;

  const highlightStyle = useMemo(
    () => getHighlightLayout(targetRect, dimensions),
    [dimensions, targetRect]
  );

  const { bubbleStyle, arrowStyle, arrowDirection } = useMemo(
    () => getBubbleLayout(targetRect, dimensions, insets),
    [dimensions, insets, targetRect]
  );

  const progressLabel = visibleStep ? `${visibleStepIndex + 1} von ${steps.length}` : '';
  const isToolsChoiceStep = visibleStep?.actionType === 'toolsChoice';
  const isVisibleFirstStep = visibleStepIndex === 0;
  const isVisibleLastStep = visibleStepIndex === steps.length - 1;
  const isStepChanging = visibleStep?.id !== currentStep?.id || visibleStepIndex !== currentStepIndex;

  if (!isTourActive) return null;

  if (!visibleStep) {
    return <View style={styles.root} pointerEvents="auto" />;
  }

  return (
    <View style={styles.root} pointerEvents="auto">
      {highlightStyle && (
        <View
          pointerEvents="none"
          style={[styles.highlight, highlightStyle]}
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
    backgroundColor: 'transparent',
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
