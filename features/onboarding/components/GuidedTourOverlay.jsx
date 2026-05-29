import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { COLORS } from '../../../constants/colors';
import { s, sv, sf, SCREEN } from '../../../constants/layout';
import { useOnboarding } from '../context/OnboardingContext';

function getBubblePosition(targetRect) {
  if (!targetRect) {
    return {
      left: s(18),
      right: s(18),
      bottom: sv(94),
    };
  }

  const targetCenterY = targetRect.y + targetRect.height / 2;
  const shouldShowBelow = targetCenterY < SCREEN.height * 0.48;

  if (shouldShowBelow) {
    return {
      left: s(18),
      right: s(18),
      top: Math.min(targetRect.y + targetRect.height + sv(18), SCREEN.height - sv(285)),
    };
  }

  return {
    left: s(18),
    right: s(18),
    bottom: Math.min(SCREEN.height - targetRect.y + sv(18), SCREEN.height - sv(140)),
  };
}

export default function GuidedTourOverlay() {
  const {
    isTourActive,
    steps,
    currentStep,
    currentStepIndex,
    isFirstStep,
    isLastStep,
    targets,
    skipTutorial,
    goToNextStep,
    goToPreviousStep,
    startToolsExplanation,
  } = useOnboarding();

  if (!isTourActive || !currentStep) return null;

  const targetRect = currentStep.targetId ? targets[currentStep.targetId] : null;
  const bubbleStyle = getBubblePosition(targetRect);
  const progressLabel = `${currentStepIndex + 1} von ${steps.length}`;
  const isToolsChoiceStep = currentStep.actionType === 'toolsChoice';

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
        <View style={styles.topRow}>
          <Text style={styles.eyebrow}>{currentStep.eyebrow}</Text>
          <Text style={styles.progress}>{progressLabel}</Text>
        </View>

        <Text style={styles.title}>{currentStep.title}</Text>
        <Text style={styles.text}>{currentStep.text}</Text>

        {isToolsChoiceStep ? (
          <View style={styles.choiceFooter}>
            <Pressable style={styles.choiceSecondaryButton} onPress={goToNextStep}>
              <Text style={styles.choiceSecondaryText}>{currentStep.primaryLabel ?? 'Loslegen'}</Text>
            </Pressable>

            <Pressable style={styles.choicePrimaryButton} onPress={startToolsExplanation}>
              <Text style={styles.choicePrimaryText}>{currentStep.secondaryLabel ?? 'Tools erklären'}</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.footerRow}>
            <Pressable style={styles.skipButton} onPress={skipTutorial}>
              <Text style={styles.skipText}>Überspringen</Text>
            </Pressable>

            <View style={styles.actionRow}>
              {!isFirstStep && (
                <Pressable style={styles.backButton} onPress={goToPreviousStep}>
                  <Feather name="chevron-left" size={s(18)} color={COLORS.toolsText} />
                </Pressable>
              )}

              <Pressable style={styles.nextButton} onPress={goToNextStep}>
                <Text style={styles.nextButtonText}>
                  {isLastStep ? 'Loslegen' : currentStep.primaryLabel ?? 'Weiter'}
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
    minHeight: sv(40),
    justifyContent: 'center',
  },
  skipText: {
    color: 'rgba(255,241,210,0.52)',
    fontSize: sf(13),
    fontWeight: '700',
  },
  choiceFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(10),
  },
  choiceSecondaryButton: {
    flex: 1,
    minHeight: sv(44),
    borderRadius: s(999),
    borderWidth: 1,
    borderColor: 'rgba(255,241,210,0.16)',
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: s(12),
  },
  choiceSecondaryText: {
    color: 'rgba(255,241,210,0.78)',
    fontSize: sf(13),
    fontWeight: '800',
    textAlign: 'center',
  },
  choicePrimaryButton: {
    flex: 1.15,
    minHeight: sv(44),
    borderRadius: s(999),
    backgroundColor: COLORS.toolsGold,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: s(12),
  },
  choicePrimaryText: {
    color: COLORS.nearBlack,
    fontSize: sf(13),
    fontWeight: '900',
    textAlign: 'center',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(8),
  },
  backButton: {
    width: s(40),
    height: s(40),
    borderRadius: s(20),
    borderWidth: 1,
    borderColor: 'rgba(255,241,210,0.16)',
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  nextButton: {
    minHeight: sv(42),
    borderRadius: s(999),
    backgroundColor: COLORS.toolsGold,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: s(18),
  },
  nextButtonText: {
    color: COLORS.nearBlack,
    fontSize: sf(14),
    fontWeight: '900',
  },
});
