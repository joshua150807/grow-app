import { useEffect, useRef, useState } from "react";
import { View, Pressable, StyleSheet, Dimensions } from "react-native";
import { VideoView, useVideoPlayer } from "expo-video";

import VideoOverlay from "./VideoOverlay";
import FeedProgressBar from "./FeedProgressBar";
import TourTarget from "../../onboarding/components/TourTarget";
import { useWatchReward } from "../hooks/useWatchReward";
import { useVideoProgress } from "../hooks/useVideoProgress";
import { useVideoRating } from "../hooks/useVideoRating";
import { COLORS } from "../../../constants/colors";
import { s, sv, sf, SCREEN } from "../../../constants/layout";
import { logVideoPlayerError } from "../utils/videoPlayerSafety";

const { width, height } = Dimensions.get("window");

const LONG_PRESS_DELAY = 120;

export default function FeedItem({
  item,
  userId,
  isActive,
  isFeedFocused,
  isMuted,
  setIsMuted,
  onToggleSaved,
  onVideoReady,
  onScrubStart,
  onScrubEnd,
  onRatingDragStart,
  onRatingDragEnd,
  isInteractionDisabled = false,
}) {
  const [isHolding, setIsHolding] = useState(false);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [isPausedByUser, setIsPausedByUser] = useState(false);

  const hasReportedReady = useRef(false);
  const isMountedRef = useRef(true);

  const player = useVideoPlayer(item.source, (playerInstance) => {
    playerInstance.loop = true;
  });

  const pausePlayerSafely = () => {
    try {
      player.pause();
    } catch (error) {
      logVideoPlayerError("Fehler beim Pausieren des Videos:", error);
    }
  };

  const playPlayerSafely = () => {
    try {
      player.play();
    } catch (error) {
      logVideoPlayerError("Fehler beim Starten des Videos:", error);
    }
  };

  const resetPlayerSafely = () => {
    pausePlayerSafely();

    try {
      player.currentTime = 0;
    } catch (error) {
      logVideoPlayerError("Fehler beim Zurücksetzen des Videos:", error);
    }
  };

  useEffect(() => {
    try {
      player.muted = isMuted;
    } catch (error) {
      logVideoPlayerError("Fehler beim Stummschalten des Videos:", error);
    }
  }, [isMuted, player]);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
    };
  }, [player]);

  const {
    progress,
    duration,
    canScrub,
    safeProgress,
    thumbLeft,
    setTrackWidth,
    panHandlers,
    setProgress,
    currentTimeText,
    durationText,
  } = useVideoProgress({
    player,
    isActive,
    isFeedFocused,
    isScrubbing,
    setIsScrubbing,
    onScrubStart,
    onScrubEnd,
  });

  useEffect(() => {
    const shouldPlay =
      isActive &&
      isFeedFocused &&
      !isHolding &&
      !isScrubbing &&
      !isPausedByUser;

    if (!isActive) {
      resetPlayerSafely();
      setProgress(0);
      setIsPausedByUser(false);
      return;
    }

    if (!isFeedFocused) {
      pausePlayerSafely();
      return;
    }

    if (shouldPlay) {
      playPlayerSafely();
    } else {
      pausePlayerSafely();
    }
  }, [
    isActive,
    isFeedFocused,
    isHolding,
    isScrubbing,
    isPausedByUser,
    player,
    setProgress,
  ]);

  const { showPointReward } = useWatchReward({
    isActive,
    progress,
    duration,
    userId,
    videoId: item.id,
    isScrubbing,
  });

  const { activeRating, rate } = useVideoRating({
    userId,
    videoId: item.id,
    isActive,
  });

  return (
    <View style={styles.page}>
      {isActive && (
        <TourTarget
          id="feed-video-area"
          style={styles.videoTourTarget}
          pointerEvents="none"
        />
      )}

      <VideoView
        style={styles.video}
        player={player}
        contentFit="contain"
        nativeControls={false}
        onFirstFrameRender={() => {
          if (!hasReportedReady.current && isMountedRef.current) {
            hasReportedReady.current = true;
            onVideoReady?.();
          }
        }}
      />

      <Pressable
        style={styles.touchLayer}
        pointerEvents={isInteractionDisabled ? "none" : "auto"}
        disabled={isInteractionDisabled}
        onPress={() => setIsPausedByUser((prev) => !prev)}
        onLongPress={() => setIsHolding(true)}
        delayLongPress={LONG_PRESS_DELAY}
        onPressOut={() => setIsHolding(false)}
      />

      <View style={styles.overlayDark} pointerEvents="none" />

      <View
        style={styles.overlayContent}
        pointerEvents={isInteractionDisabled ? "none" : "box-none"}
      >
        <VideoOverlay
          saved={item.saved}
          onToggleSaved={onToggleSaved}
          isPaused={isPausedByUser}
          isMuted={isMuted}
          showPointReward={showPointReward}
          activeRating={activeRating}
          onRate={rate}
          onRatingDragStart={onRatingDragStart}
          onRatingDragEnd={onRatingDragEnd}
          onResume={() => setIsPausedByUser(false)}
          onMuteAndResume={() => {
            setIsMuted((prev) => !prev);
            setIsPausedByUser(false);
          }}
          isActive={isActive}
        />
      </View>

      <FeedProgressBar
        safeProgress={safeProgress}
        canScrub={canScrub}
        thumbLeft={thumbLeft}
        onTrackLayout={(event) => setTrackWidth(event.nativeEvent.layout.width)}
        panHandlers={panHandlers}
        isScrubbing={isScrubbing}
        currentTimeText={currentTimeText}
        durationText={durationText}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    width,
    height,
    backgroundColor: COLORS.background,
  },
  video: {
    position: "absolute",
    width: "100%",
    height: "100%",
  },
  videoTourTarget: {
    position: "absolute",
    left: s(20),
    right: s(68),
    top: SCREEN.height * 0.22,
    height: SCREEN.height * 0.42,
    zIndex: 3,
  },
  touchLayer: {
    position: "absolute",
    width: "100%",
    height: "100%",
    zIndex: 2,
  },
  overlayDark: {
    position: "absolute",
    width: "100%",
    height: "100%",
    backgroundColor: COLORS.overlayDark,
    zIndex: 1,
  },
  overlayContent: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 6,
  },
});
