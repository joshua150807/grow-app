import { useLocalSearchParams } from 'expo-router';

import VideoFeed from '../../features/feed/components/VideoFeed';
import { getSavedVideos } from '../../features/feed/services/videos';

export default function SavedFeedScreen() {
  const params = useLocalSearchParams();
  const initialIndex = Number(params.initialIndex ?? 0);

  return (
    <VideoFeed
      loadVideos={getSavedVideos}
      initialIndex={initialIndex}
      emptyTitle="Keine gespeicherten Videos"
      emptyText="Du hast aktuell keine Videos in deiner Sammlung."
      errorMessage="Gespeicherte Videos konnten nicht geladen werden."
      showBackButton
      backRoute="/(tabs)/tools/saved-videos"
      reloadOnFocus
      removeUnsavedVideos
    />
  );
}