import { useEffect, useRef, useState } from "react";
import { View, Pressable, StyleSheet, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { VideoView, useVideoPlayer } from "expo-video";

import VideoOverlay from "./VideoOverlay";
import FeedProgressBar from "./FeedProgressBar";
import TourTarget from "../../onboarding/components/TourTarget";
import { useWatchReward } from "../hooks/useWatchReward";
import { useVideoProgress } from "../hooks/useVideoProgress";
import { useVideoRating } from "../hooks/useVideoRating";
import { COLORS } from "../../../constants/colors";
import { s, sv, SCREEN } from "../../../constants/layout";
import { logVideoPlayerError } from "../utils/videoPlayerSafety";


const LONG_PRESS_DELAY = 120;

function getVisibleTabBarHeight(screenHeight) {
  return Math.round(Math.min(44, Math.max(34, screenHeight * 0.045)));
}

const ANDROID_PROGRESS_BASE_LIFT = 7.5;
const ANDROID_TALL_DEVICE_START_HEIGHT = 860;
const ANDROID_TALL_DEVICE_RANGE = 180;
const ANDROID_TALL_DEVICE_MAX_EXTRA_LIFT = 6.5;

// Kleine Extra-Korrektur für mittelhohe Android-Geräte wie Pixel 6.
// Pixel 5 bleibt darunter, Pixel 9 Pro XL liegt darüber und wird dadurch nicht verändert.
const ANDROID_MID_DEVICE_START_HEIGHT = 880;
const ANDROID_MID_DEVICE_PEAK_HEIGHT = 920;
const ANDROID_MID_DEVICE_END_HEIGHT = 960;
const ANDROID_MID_DEVICE_EXTRA_LIFT = 1;

function getAndroidMidDeviceLift(screenHeight) {
  if (screenHeight <= ANDROID_MID_DEVICE_START_HEIGHT) return 0;
  if (screenHeight >= ANDROID_MID_DEVICE_END_HEIGHT) return 0;

  if (screenHeight <= ANDROID_MID_DEVICE_PEAK_HEIGHT) {
    const progress =
      (screenHeight - ANDROID_MID_DEVICE_START_HEIGHT) /
      (ANDROID_MID_DEVICE_PEAK_HEIGHT - ANDROID_MID_DEVICE_START_HEIGHT);

    return progress * ANDROID_MID_DEVICE_EXTRA_LIFT;
  }

  const progress =
    (ANDROID_MID_DEVICE_END_HEIGHT - screenHeight) /
    (ANDROID_MID_DEVICE_END_HEIGHT - ANDROID_MID_DEVICE_PEAK_HEIGHT);

  return progress * ANDROID_MID_DEVICE_EXTRA_LIFT;
}

function getAndroidProgressLift(screenHeight) {
  if (!SCREEN.isAndroid) return 0;

  const tallDeviceProgress = Math.min(
    1,
    Math.max(
      0,
      (screenHeight - ANDROID_TALL_DEVICE_START_HEIGHT) / ANDROID_TALL_DEVICE_RANGE
    )
  );

  return (
    sv(ANDROID_PROGRESS_BASE_LIFT) +
    tallDeviceProgress * ANDROID_TALL_DEVICE_MAX_EXTRA_LIFT +
    getAndroidMidDeviceLift(screenHeight)
  );
}

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
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();

  const [isHolding, setIsHolding] = useState(false);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [isPausedByUser, setIsPausedByUser] = useState(false);

  const hasReportedReady = useRef(false);
  const isMountedRef = useRef(true);

  const player = useVideoPlayer(item.source, (playerInstance) => {
    playerInstance.loop = true;
  });

  const visibleTabBarHeight = getVisibleTabBarHeight(height);

  // Muss mit deinem Android-Lift in FeedProgressBar.jsx übereinstimmen.
  const androidProgressLift = getAndroidProgressLift(height);

  const videoBottom =
    insets.bottom + visibleTabBarHeight + androidProgressLift;

  const mediaLayerStyle = {
    bottom: videoBottom,
  };

  const videoTourTargetTop = Math.max(insets.top + sv(62), height * 0.12);
  const videoTourTargetBottom = videoBottom + sv(74);
  const videoTourTargetStyle = {
    left: s(14),
    right: s(74),
    top: videoTourTargetTop,
    height: Math.max(sv(240), height - videoTourTargetTop - videoTourTargetBottom),
  };

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
    <View style={[styles.page, { width, height }]}>
      {isActive && (
        <TourTarget
          id="feed-video-area"
          style={[styles.videoTourTarget, videoTourTargetStyle]}
          pointerEvents="none"
        />
      )}

      <VideoView
        style={[styles.video, mediaLayerStyle]}
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
        style={[styles.touchLayer, mediaLayerStyle]}
        pointerEvents={isInteractionDisabled ? "none" : "auto"}
        disabled={isInteractionDisabled}
        onPress={() => setIsPausedByUser((prev) => !prev)}
        onLongPress={() => setIsHolding(true)}
        delayLongPress={LONG_PRESS_DELAY}
        onPressOut={() => setIsHolding(false)}
      />

      <View
        style={[styles.overlayDark, mediaLayerStyle]}
        pointerEvents="none"
      />

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
    backgroundColor: COLORS.background,
  },

  video: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
  },

  videoTourTarget: {
    position: "absolute",
    zIndex: 3,
  },

  touchLayer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 2,
  },

  overlayDark: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.overlayDark,
    zIndex: 1,
  },

  overlayContent: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 6,
  },
});