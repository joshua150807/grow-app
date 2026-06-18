import { logger } from '../../../lib/logger';
import { useCallback, useEffect, useRef, useState } from "react";
import {
  AppState,
  Dimensions,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect, useIsFocused } from "@react-navigation/native";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";

import { COLORS } from "../../../constants/colors";
import { s, sv, sf } from "../../../constants/layout";
import FeedItem from "./FeedItem";
import { getSavedVideoIds, toggleVideoBookmark } from "../services/videos";
import { supabase } from "../../../services/supabaseClient";

const { height } = Dimensions.get("window");
const VIDEO_READY_TIMEOUT_MS = 6500;

export default function VideoFeed({
  loadVideos,
  initialIndex = 0,
  emptyTitle = "Noch keine Videos",
  emptyText = "Aktuell sind keine Videos verfügbar.",
  errorMessage = "Videos konnten nicht geladen werden.",
  reloadButtonText = "Erneut versuchen",
  showBackButton = false,
  reloadOnFocus = false,
  syncSavedStateOnFocus = false,
  removeUnsavedVideos = false,
  isDisabled = false,
}) {
  const [feedData, setFeedData] = useState([]);
  const [activeVideoId, setActiveVideoId] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [userId, setUserId] = useState(null);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [feedError, setFeedError] = useState(null);
  const [hasNoVideos, setHasNoVideos] = useState(false);
  const [isFeedScrollEnabled, setIsFeedScrollEnabled] = useState(true);

  const isFocused = useIsFocused();
  const flatListRef = useRef(null);
  const currentIndexRef = useRef(initialIndex);
  const activeVideoIdRef = useRef(null);
  const isFeedScrollEnabledRef = useRef(true);
  const isFirstFocus = useRef(true);
  const videoReadyFallbackTimerRef = useRef(null);
  const scrollFrameRef = useRef(null);
  const isMountedRef = useRef(true);
  const loadRequestIdRef = useRef(0);
  const bookmarkRequestRef = useRef(new Set());
  const [isAppActive, setIsAppActive] = useState(true);

  const clearVideoReadyFallbackTimer = useCallback(() => {
    if (videoReadyFallbackTimerRef.current) {
      clearTimeout(videoReadyFallbackTimerRef.current);
      videoReadyFallbackTimerRef.current = null;
    }
  }, []);

  const clearScrollFrame = useCallback(() => {
    if (scrollFrameRef.current) {
      cancelAnimationFrame(scrollFrameRef.current);
      scrollFrameRef.current = null;
    }
  }, []);

  const setFeedScrollEnabledSafely = useCallback((nextValue) => {
    isFeedScrollEnabledRef.current = nextValue;
    setIsFeedScrollEnabled(nextValue);
  }, []);

  const disableFeedScroll = useCallback(() => {
    setFeedScrollEnabledSafely(false);
  }, [setFeedScrollEnabledSafely]);

  const enableFeedScroll = useCallback(() => {
    setFeedScrollEnabledSafely(true);
  }, [setFeedScrollEnabledSafely]);

  const scrollToIndex = useCallback(
    (index, animated = false) => {
      clearScrollFrame();

      scrollFrameRef.current = requestAnimationFrame(() => {
        scrollFrameRef.current = null;

        if (!isMountedRef.current) {
          return;
        }

        flatListRef.current?.scrollToOffset({
          offset: index * height,
          animated,
        });
      });
    },
    [clearScrollFrame],
  );

  const startVideoReadyFallbackTimer = useCallback(() => {
    clearVideoReadyFallbackTimer();

    videoReadyFallbackTimerRef.current = setTimeout(() => {
      if (!isMountedRef.current) {
        return;
      }

      logger.debug("Video ready fallback: Loading wurde automatisch beendet.");
      setIsInitialLoading(false);
      videoReadyFallbackTimerRef.current = null;
    }, VIDEO_READY_TIMEOUT_MS);
  }, [clearVideoReadyFallbackTimer]);

  useEffect(() => {
    isMountedRef.current = true;

    const subscription = AppState.addEventListener("change", (nextState) => {
      setIsAppActive(nextState === "active");
    });

    return () => {
      isMountedRef.current = false;
      loadRequestIdRef.current += 1;
      clearVideoReadyFallbackTimer();
      clearScrollFrame();
      subscription.remove();
    };
  }, [clearScrollFrame, clearVideoReadyFallbackTimer]);

  useEffect(() => {
    let cancelled = false;

    async function loadFeedUser() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!cancelled && isMountedRef.current) {
          setUserId(user?.id ?? null);
        }
      } catch (error) {
        logger.debug("Fehler beim Laden des Feed-Users:", error);

        if (!cancelled && isMountedRef.current) {
          setUserId(null);
        }
      }
    }

    loadFeedUser();

    return () => {
      cancelled = true;
    };
  }, []);

  const loadFeedVideos = useCallback(async () => {
    const requestId = loadRequestIdRef.current + 1;
    loadRequestIdRef.current = requestId;

    const isCurrentRequest = () =>
      isMountedRef.current && loadRequestIdRef.current === requestId;

    try {
      clearVideoReadyFallbackTimer();
      clearScrollFrame();

      setFeedError(null);
      setHasNoVideos(false);
      setIsInitialLoading(true);

      const videos = await loadVideos();

      if (!isCurrentRequest()) {
        return;
      }

      const validVideos = Array.isArray(videos)
        ? videos.filter((video) => video?.id && video?.source)
        : [];

      if (validVideos.length === 0) {
        setFeedData([]);
        activeVideoIdRef.current = null;
        setActiveVideoId(null);
        setHasNoVideos(true);
        setIsInitialLoading(false);
        return;
      }

      const safeInitialIndex = Math.max(
        0,
        Math.min(initialIndex, validVideos.length - 1),
      );

      const initialVideoId = validVideos[safeInitialIndex].id;

      setFeedData(validVideos);
      activeVideoIdRef.current = initialVideoId;
      setActiveVideoId(initialVideoId);
      currentIndexRef.current = safeInitialIndex;

      startVideoReadyFallbackTimer();

      scrollToIndex(safeInitialIndex, false);
    } catch (error) {
      if (!isCurrentRequest()) {
        return;
      }

      logger.debug("Fehler beim Laden des Feeds:", error);
      clearVideoReadyFallbackTimer();
      setFeedData([]);
      activeVideoIdRef.current = null;
      setActiveVideoId(null);
      setFeedError(errorMessage);
      setIsInitialLoading(false);
    }
  }, [
    errorMessage,
    initialIndex,
    loadVideos,
    clearVideoReadyFallbackTimer,
    clearScrollFrame,
    scrollToIndex,
    startVideoReadyFallbackTimer,
  ]);

  useEffect(() => {
    if (!reloadOnFocus) {
      loadFeedVideos();
    }
  }, [loadFeedVideos, reloadOnFocus]);

  useFocusEffect(
    useCallback(() => {
      if (isFirstFocus.current) {
        isFirstFocus.current = false;

        if (reloadOnFocus) {
          loadFeedVideos();
        }

        return;
      }

      if (reloadOnFocus) {
        loadFeedVideos();
        return;
      }

      if (!syncSavedStateOnFocus) {
        return;
      }

      let isActive = true;

      async function syncSavedState() {
        try {
          const savedIds = await getSavedVideoIds();

          if (!isActive || !isMountedRef.current) {
            return;
          }

          setFeedData((prevData) =>
            prevData.map((video) => ({
              ...video,
              saved: savedIds.includes(video.id),
            })),
          );
        } catch (error) {
          logger.debug("Fehler beim Sync der Bookmarks:", error);
        }
      }

      syncSavedState();

      return () => {
        isActive = false;
      };
    }, [loadFeedVideos, reloadOnFocus, syncSavedStateOnFocus]),
  );

  const handleInitialVideoReady = useCallback(() => {
    if (!isMountedRef.current) {
      return;
    }

    clearVideoReadyFallbackTimer();
    setIsInitialLoading(false);
  }, [clearVideoReadyFallbackTimer]);

  const handleToggleSaved = useCallback(
    async (id) => {
      if (bookmarkRequestRef.current.has(id)) {
        return;
      }

      const video = feedData.find((item) => item.id === id);

      if (!video) {
        return;
      }

      const previousSavedState = video.saved;
      const optimisticSavedState = !previousSavedState;

      bookmarkRequestRef.current.add(id);

      // Sofortiges visuelles Feedback: Das Bookmark wird direkt umgeschaltet,
      // während die Supabase-Anfrage im Hintergrund läuft.
      setFeedData((prevData) =>
        prevData.map((item) =>
          item.id === id ? { ...item, saved: optimisticSavedState } : item,
        ),
      );

      try {
        const newSavedState = await toggleVideoBookmark(id, previousSavedState);

        if (!isMountedRef.current) {
          return;
        }

        if (removeUnsavedVideos && !newSavedState) {
          setFeedData((prevData) => {
            const nextData = prevData.filter((item) => item.id !== id);

            if (nextData.length === 0) {
              setHasNoVideos(true);
              activeVideoIdRef.current = null;
              setActiveVideoId(null);
              return [];
            }

            const nextIndex = Math.min(
              currentIndexRef.current,
              nextData.length - 1,
            );

            const nextVideoId = nextData[nextIndex].id;

            currentIndexRef.current = nextIndex;
            activeVideoIdRef.current = nextVideoId;
            setActiveVideoId(nextVideoId);

            scrollToIndex(nextIndex, true);

            return nextData;
          });

          return;
        }

        setFeedData((prevData) =>
          prevData.map((item) =>
            item.id === id ? { ...item, saved: newSavedState } : item,
          ),
        );
      } catch (error) {
        logger.debug("Fehler beim Speichern des Videos:", error);

        if (isMountedRef.current) {
          setFeedData((prevData) =>
            prevData.map((item) =>
              item.id === id ? { ...item, saved: previousSavedState } : item,
            ),
          );
        }
      } finally {
        bookmarkRequestRef.current.delete(id);
      }
    },
    [feedData, removeUnsavedVideos, scrollToIndex],
  );

  const activateVideoFromScrollOffset = useCallback(
    (offsetY) => {
      if (feedData.length === 0) {
        if (activeVideoIdRef.current !== null) {
          activeVideoIdRef.current = null;
          setActiveVideoId(null);
        }

        return;
      }

      const nextIndex = Math.max(
        0,
        Math.min(Math.round(offsetY / height), feedData.length - 1),
      );
      const nextVideo = feedData[nextIndex];

      if (!nextVideo) {
        if (activeVideoIdRef.current !== null) {
          activeVideoIdRef.current = null;
          setActiveVideoId(null);
        }

        return;
      }

      currentIndexRef.current = nextIndex;

      if (activeVideoIdRef.current !== nextVideo.id) {
        activeVideoIdRef.current = nextVideo.id;
        setActiveVideoId(nextVideo.id);
      }
    },
    [feedData],
  );

  const handleScroll = useCallback(
    (event) => {
      // Beim Swipen früh auf das sichtbarste Video wechseln. Dadurch stoppt der
      // alte Sound schnell, aber das neue Video startet nicht erst am Scroll-Ende.
      activateVideoFromScrollOffset(event.nativeEvent.contentOffset.y);
    },
    [activateVideoFromScrollOffset],
  );

  const handleScrollEndDrag = useCallback(
    (event) => {
      const velocityY = Math.abs(event.nativeEvent.velocity?.y ?? 0);

      // Wenn kein echtes Momentum mehr folgt, direkt das sichtbare Video aktivieren.
      if (velocityY < 0.05) {
        activateVideoFromScrollOffset(event.nativeEvent.contentOffset.y);
      }
    },
    [activateVideoFromScrollOffset],
  );

  const handleMomentumScrollEnd = useCallback(
    (event) => {
      activateVideoFromScrollOffset(event.nativeEvent.contentOffset.y);
    },
    [activateVideoFromScrollOffset],
  );

  const renderItem = useCallback(
    ({ item, index }) => (
      <FeedItem
        item={item}
        userId={userId}
        isActive={item.id === activeVideoId}
        isFeedFocused={isFocused && isAppActive && !isDisabled}
        isInteractionDisabled={isDisabled}
        isMuted={isMuted}
        setIsMuted={setIsMuted}
        onToggleSaved={() => handleToggleSaved(item.id)}
        onScrubStart={disableFeedScroll}
        onScrubEnd={enableFeedScroll}
        onRatingDragStart={disableFeedScroll}
        onRatingDragEnd={enableFeedScroll}
        onVideoReady={
          index === currentIndexRef.current
            ? handleInitialVideoReady
            : undefined
        }
      />
    ),
    [
      activeVideoId,
      disableFeedScroll,
      enableFeedScroll,
      handleInitialVideoReady,
      handleToggleSaved,
      isAppActive,
      isDisabled,
      isFocused,
      isMuted,
      userId,
    ],
  );

  if (feedError) {
    return (
      <View style={styles.stateContainer}>
        <Text style={styles.stateTitle}>Fehler</Text>
        <Text style={styles.stateText}>{feedError}</Text>

        <Pressable style={styles.stateButton} onPress={loadFeedVideos}>
          <Text style={styles.stateButtonText}>{reloadButtonText}</Text>
        </Pressable>
      </View>
    );
  }

  if (hasNoVideos) {
    return (
      <View style={styles.stateContainer}>
        <Text style={styles.stateTitle}>{emptyTitle}</Text>
        <Text style={styles.stateText}>{emptyText}</Text>

        <Pressable
          style={styles.stateButton}
          onPress={showBackButton ? () => router.back() : loadFeedVideos}
        >
          <Text style={styles.stateButtonText}>
            {showBackButton ? "Zurück" : "Neu laden"}
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {feedData.length > 0 && (
        <FlatList
          ref={flatListRef}
          data={feedData}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          extraData={feedData}
          scrollEnabled={!isDisabled && isFeedScrollEnabled}
          pagingEnabled
          snapToInterval={height}
          snapToAlignment="start"
          disableIntervalMomentum
          decelerationRate="fast"
          bounces={false}
          overScrollMode="never"
          showsVerticalScrollIndicator={false}
          onScroll={handleScroll}
          scrollEventThrottle={80}
          onScrollEndDrag={handleScrollEndDrag}
          onMomentumScrollEnd={handleMomentumScrollEnd}
          windowSize={3}
          initialNumToRender={2}
          maxToRenderPerBatch={2}
          updateCellsBatchingPeriod={40}
          removeClippedSubviews={false}
          getItemLayout={(_, index) => ({
            length: height,
            offset: height * index,
            index,
          })}
        />
      )}

      {showBackButton && (
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Feather name="chevron-left" size={26} color={COLORS.softGold} />
        </Pressable>
      )}

      {isInitialLoading && (
        <View style={styles.loadingOverlay}>
          <Image
            source={require("../../../assets/images/grow-loading.png")}
            style={styles.loadingLogo}
            resizeMode="contain"
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  backButton: {
    position: "absolute",
    top: 56,
    left: 18,
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(0,0,0,0.45)",
    borderWidth: 1,
    borderColor: COLORS.goldBorder,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 20,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.background,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 999,
  },
  loadingLogo: {
    width: 180,
    height: 180,
  },
  stateContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 30,
  },
  stateTitle: {
    color: COLORS.white,
    fontSize: sf(24),
    fontWeight: "700",
    marginBottom: sv(12),
    textAlign: "center",
  },
  stateText: {
    color: COLORS.mutedGold,
    fontSize: sf(15),
    textAlign: "center",
    lineHeight: 22,
  },
  stateButton: {
    marginTop: 22,
    backgroundColor: COLORS.gold,
    paddingHorizontal: s(20),
    paddingVertical: sv(12),
    borderRadius: s(12),
  },
  stateButtonText: {
    color: COLORS.black,
    fontSize: sf(15),
    fontWeight: "700",
  },
});
