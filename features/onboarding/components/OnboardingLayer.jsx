import GuidedTourOverlay from './GuidedTourOverlay';
import TutorialStartPrompt from './TutorialStartPrompt';
import { useOnboarding } from '../context/OnboardingContext';

export default function OnboardingLayer() {
  const {
    isPromptVisible,
    isTourActive,
    declineInitialPrompt,
    startTutorial,
  } = useOnboarding();

  return (
    <>
      <TutorialStartPrompt
        visible={isPromptVisible && !isTourActive}
        onDecline={declineInitialPrompt}
        onStart={() => startTutorial({ fromPrompt: true })}
      />

      <GuidedTourOverlay />
    </>
  );
}
