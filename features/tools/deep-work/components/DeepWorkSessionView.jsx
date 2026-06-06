import { ImageBackground, View, Text, Pressable, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { COLORS } from '../../../../constants/colors';
import { DEEPWORK_PAGE_BG } from '../../../../constants/toolAssets';
import { s } from '../../../../constants/layout';
import { formatTime } from '../utils/deepWorkUtils';
import { styles } from '../styles/deepWorkStyles';
import { triggerHaptic } from '../../../../lib/haptics';

export default function DeepWorkSessionView({
  router,
  phase,
  taskName,
  category,
  remaining,
  progress,
  pulseAnim,
  togglePause,
  endSession,
}) {
  return (
    <ImageBackground
      source={DEEPWORK_PAGE_BG}
      style={styles.screen}
      imageStyle={styles.deepWorkPageBackgroundImage}
      resizeMode="cover"
    >
      <View style={styles.pageOverlay} pointerEvents="none" />
      <Pressable
        onPress={() => {
          if (phase !== 'running') {
            router.back();
          }
        }}
        hitSlop={10}
        style={({ pressed }) => [
          styles.sessionBackButton,
          phase === 'running' && styles.sessionBackButtonHidden,
          pressed && phase !== 'running' && styles.subtlePressed,
        ]}
        disabled={phase === 'running'}
      >
        <Ionicons name="chevron-back" size={s(24)} color={COLORS.softGold} />
        <Text style={styles.backText}>Tools</Text>
      </Pressable>

      <View style={styles.sessionHeader}>
        <Ionicons name="hourglass" size={s(42)} color={COLORS.gold} />
        <Text style={styles.title}>DEEP WORK</Text>
        <Text style={styles.subtitle}>Disziplin. Fokus. Keine Ablenkung.</Text>
      </View>

      <View style={styles.timerBlock}>
        <Text style={styles.timerText}>{formatTime(remaining)}</Text>
        <Text style={styles.taskName}>{taskName}</Text>

        <View style={styles.categoryBadge}>
          <Text style={styles.categoryBadgeText}>
            {category.toUpperCase()}
          </Text>
        </View>
      </View>

      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
      </View>

      <View style={styles.controlArea}>
        <Animated.View
          style={[
            styles.pauseRingOuter,
            { transform: [{ scale: pulseAnim }] },
          ]}
        >
          <Pressable
            style={({ pressed }) => [
              styles.pauseButton,
              pressed && styles.pauseButtonPressed,
            ]}
            onPress={() => {
              void triggerHaptic('selection');
              togglePause();
            }}
            hitSlop={8}
          >
            <Ionicons
              name={phase === 'running' ? 'pause' : 'play'}
              size={s(38)}
              color={COLORS.gold}
            />
          </Pressable>
        </Animated.View>
      </View>

      <View style={styles.bottomArea}>
        <Pressable
          style={({ pressed }) => [
            styles.endButton,
            pressed && styles.secondaryButtonPressed,
          ]}
          onPress={() => {
            void triggerHaptic('medium');
            endSession();
          }}
        >
          <Text style={styles.endButtonText}>Session beenden</Text>
        </Pressable>
      </View>
    </ImageBackground>
  );
}