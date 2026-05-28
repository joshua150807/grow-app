import VideoFeed from '../../features/feed/components/VideoFeed';
import { getActiveVideos } from '../../features/feed/services/videos';

export default function FeedScreen() {
  return (
    <VideoFeed
      loadVideos={getActiveVideos}
      emptyTitle="Noch keine Videos"
      emptyText="Aktuell sind keine aktiven Videos verfügbar."
      errorMessage="Videos konnten nicht geladen werden."
      syncSavedStateOnFocus
    />
  );
}