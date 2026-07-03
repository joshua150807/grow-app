import VideoFeed from '../../features/feed/components/VideoFeed';
import { getActiveVideos } from '../../features/feed/services/videos';
import { useOnboarding } from '../../features/onboarding/context/OnboardingContext';

export default function FeedScreen() {
  const { isTourActive, isPromptVisible } = useOnboarding();

  const shouldPauseFeed = isTourActive || isPromptVisible;

  return (
    <VideoFeed
      loadVideos={getActiveVideos}
      emptyTitle="Noch keine Videos"
      emptyText="Aktuell sind keine aktiven Videos verfügbar."
      errorMessage="Videos konnten nicht geladen werden."
      syncSavedStateOnFocus
      isDisabled={shouldPauseFeed}
    />
  );
}