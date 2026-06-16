import { useEffect, useRef } from 'react';
import { Animated, View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';

import { COLORS } from '../../../constants/colors';
import { s, sv, sf, SCREEN } from '../../../constants/layout';
import TourTarget from '../../onboarding/components/TourTarget';
import VideoRatingSlider from './VideoRatingSlider';

const GROW_LOGO_HEADER = require('../../../assets/images/grow_banner_lossless.webp');

export default function VideoOverlay({
  saved = false,
  onToggleSaved = () => {},
  isPaused = false,
  onResume = () => {},
  onMuteAndResume = () => {},
  isMuted = false,
  showPointReward = false,
  activeRating = null,
  onRate = () => {},
  onRatingDragStart = () => {},
  onRatingDragEnd = () => {},
  isActive = false,
}) {
  const pointFlyY = useRef(new Animated.Value(0)).current;
  const pointOpacity = useRef(new Animated.Value(0)).current;
  const pointScale = useRef(new Animated.Value(0.86)).current;

  useEffect(() => {
    if (!showPointReward) {
      pointFlyY.setValue(0);
      pointOpacity.setValue(0);
      pointScale.setValue(0.86);
      return;
    }

    pointFlyY.setValue(0);
    pointOpacity.setValue(0);
    pointScale.setValue(0.86);

    Animated.parallel([
      Animated.timing(pointFlyY, {
        toValue: -sv(54),
        duration: 900,
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.timing(pointOpacity, {
          toValue: 1,
          duration: 120,
          useNativeDriver: true,
        }),
        Animated.timing(pointOpacity, {
          toValue: 0,
          duration: 520,
          delay: 260,
          useNativeDriver: true,
        }),
      ]),
      Animated.sequence([
        Animated.spring(pointScale, {
          toValue: 1.12,
          speed: 18,
          bounciness: 8,
          useNativeDriver: true,
        }),
        Animated.timing(pointScale, {
          toValue: 0.96,
          duration: 560,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, [pointFlyY, pointOpacity, pointScale, showPointReward]);

  const handleClearRating = () => {
    onRate(null);
  };

  return (
    <View style={styles.container} pointerEvents="box-none">
      <Image
        source={GROW_LOGO_HEADER}
        style={styles.logoImage}
        resizeMode="contain"
      />

      <View style={styles.rightSide} pointerEvents="box-none">
        <TourTarget
          id={isActive ? 'feed-actions' : null}
          style={styles.actionsTarget}
          pointerEvents="box-none"
        >
          <VideoRatingSlider
            currentRating={activeRating}
            onRatingSubmit={onRate}
            onRatingClear={handleClearRating}
            onDragStart={onRatingDragStart}
            onDragEnd={onRatingDragEnd}
          />

          <TouchableOpacity
            style={styles.saveButton}
            onPress={onToggleSaved}
            activeOpacity={0.8}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            {saved ? (
              <Ionicons name="bookmark" size={s(31)} color={COLORS.gold} />
            ) : (
              <Feather name="bookmark" size={s(31)} color={COLORS.gold} />
            )}
          </TouchableOpacity>

          {showPointReward && (
            <Animated.View
              style={[
                styles.pointBubble,
                {
                  opacity: pointOpacity,
                  transform: [
                    { translateY: pointFlyY },
                    { scale: pointScale },
                  ],
                },
              ]}
              pointerEvents="none"
            >
              <Text style={styles.pointBubbleText}>+1</Text>
            </Animated.View>
          )}
        </TourTarget>
      </View>

      {isPaused && (
        <View style={styles.pauseOverlay} pointerEvents="box-none">
          <TouchableOpacity
            style={styles.muteResumeButton}
            onPress={onMuteAndResume}
            activeOpacity={0.85}
          >
            <Ionicons
              name={isMuted ? 'volume-mute' : 'volume-high'}
              size={s(18)}
              color={COLORS.white}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.playButton}
            onPress={onResume}
            activeOpacity={0.85}
          >
            <Ionicons name="play" size={s(34)} color={COLORS.white} />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  logoImage: {
    position: 'absolute',
    top: sv(61),
    alignSelf: 'center',
    width: s(185),
    height: sv(42),
  },

  rightSide: {
    position: 'absolute',
    right: s(5),
    top: SCREEN.height * 0.32,
    alignItems: 'center',
  },

  actionsTarget: {
    alignItems: 'center',
  },

  saveButton: {
    marginTop: sv(36),
    width: s(42),
    height: s(42),
    justifyContent: 'center',
    alignItems: 'center',
    transform: [{ translateX: s(2) }]
  },

  pauseOverlay: {
    position: 'absolute',
    top: '50%',
    left: 0,
    right: 0,
    alignItems: 'center',
    transform: [{ translateY: -sv(72) }],
  },

  muteResumeButton: {
    width: s(46),
    height: s(46),
    borderRadius: s(23),
    marginBottom: sv(14),
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },

  playButton: {
    width: s(72),
    height: s(72),
    borderRadius: s(36),
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingLeft: s(4),
  },

  pointBubble: {
    marginTop: sv(60),
    width: s(30),
    height: s(30),
    borderRadius: s(15),
    backgroundColor: COLORS.gold,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: COLORS.black,
    shadowOpacity: 0.22,
    shadowRadius: s(6),
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },

  pointBubbleText: {
    color: COLORS.nearBlack,
    fontSize: sf(11),
    fontWeight: '800',
  },
});