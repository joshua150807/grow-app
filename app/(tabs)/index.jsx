import { useCallback, useRef } from 'react';

import VideoFeed from '../../features/feed/components/VideoFeed';
import { getActiveVideos } from '../../features/feed/services/videos';

export default function FeedScreen() {
  const hasStartedPostFeedPreloadRef = useRef(false);

  const handleFirstFeedVideoShown = useCallback(() => {
    if (hasStartedPostFeedPreloadRef.current) return;

    hasStartedPostFeedPreloadRef.current = true;

    // Wichtig: Nicht statisch importieren.
    // Die Tool-Preload-Services sollen erst nach dem ersten sichtbaren Feed-Video geladen werden.
    // Der Delay hält die ersten Feed-Swipes frei von zusätzlicher JS-Arbeit.
    setTimeout(() => {
      import('../../lib/preloadToolsAfterFeedReady')
        .then(({ startToolPreloadAfterFeedReady }) => {
          startToolPreloadAfterFeedReady();
        })
        .catch((error) => {
          console.log('Tool-Preload nach Feed-Start konnte nicht gestartet werden:', error);
        });
    }, 2200);
  }, []);

  return (
    <VideoFeed
      loadVideos={getActiveVideos}
      emptyTitle="Noch keine Videos"
      emptyText="Aktuell sind keine aktiven Videos verfügbar."
      errorMessage="Videos konnten nicht geladen werden."
      syncSavedStateOnFocus
      onFirstVideoShown={handleFirstFeedVideoShown}
    />
  );
}