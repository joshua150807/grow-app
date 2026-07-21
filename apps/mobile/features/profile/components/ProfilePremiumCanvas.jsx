import { ActivityIndicator, Image, ImageBackground, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

import { COLORS } from '../../../constants/colors';
import { GROW_AVATAR, GROW_COIN, GROW_POINTS_ICON } from '../../../constants/toolAssets';

const ART_WIDTH = 855;
const ART_HEIGHT = 1840;
const ART_ASPECT_RATIO = ART_WIDTH / ART_HEIGHT;
const PROFILE_BACKGROUND = require('../../../assets/images/profile_background.webp');

function frame(canvasWidth, x, y, width, height) {
  const scale = canvasWidth / ART_WIDTH;
  return {
    left: x * scale,
    top: y * scale,
    width: width * scale,
    height: height * scale,
  };
}

function BalanceContent({ canvasWidth, icon, value, label, side }) {
  const box = side === 'left'
    ? frame(canvasWidth, 54, 628, 345, 158)
    : frame(canvasWidth, 454, 628, 345, 158);
  const scale = canvasWidth / ART_WIDTH;
  const iconScale = side === 'left' ? 2.2 : 2;

  return (
    <View style={[styles.absoluteCenter, box, styles.balanceContent]}>
      <Image
        source={icon}
        style={{
          width: 54 * scale,
          height: 54 * scale,
          transform: [{ translateX: -22 * scale }, { scale: iconScale }],
        }}
        resizeMode="contain"
      />
      <View style={styles.balanceText}>
        <Text style={[styles.balanceValue, { fontSize: Math.max(15, 31 * scale) }]} numberOfLines={1}>
          {value}
        </Text>
        <Text style={[styles.balanceLabel, { fontSize: Math.max(9, 19 * scale) }]} numberOfLines={1}>
          {label}
        </Text>
      </View>
    </View>
  );
}

function PremiumStat({ canvasWidth, item, index }) {
  const column = index % 3;
  const row = Math.floor(index / 3);
  const columns = [49, 300, 570];
  const widths = [231, 240, 234];
  const box = frame(canvasWidth, columns[column], row === 0 ? 1003 : 1240, widths[column], 230);
  const scale = canvasWidth / ART_WIDTH;

  return (
    <View style={[styles.absoluteCenter, box, styles.statContent]}>
      <MaterialCommunityIcons
        name={item.icon}
        size={Math.max(16, 34 * scale)}
        color={COLORS.gold}
        style={{ transform: [{ translateY: -18 * scale }, { scale: 2 }] }}
      />
      <Text
        style={[styles.statValue, { fontSize: Math.max(15, 30 * scale), marginTop: 10 * scale }]}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {item.value}
      </Text>
      <Text
        style={[
          styles.statLabel,
          { fontSize: Math.max(8.5, 17 * scale), lineHeight: Math.max(11, 22 * scale), marginTop: 6 * scale },
        ]}
        numberOfLines={2}
      >
        {item.label}
      </Text>
    </View>
  );
}

function ActionContent({ canvasWidth, top, icon, label, disabled, onPress }) {
  const box = frame(canvasWidth, 48, top, 757, 104);
  const scale = canvasWidth / ART_WIDTH;

  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.absoluteCenter,
        box,
        styles.actionContent,
        disabled && styles.actionDisabled,
        pressed && styles.actionPressed,
      ]}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
    >
      <Ionicons name={icon} size={Math.max(18, 30 * scale)} color={disabled ? COLORS.textDim : COLORS.softGold} />
      <Text style={[styles.actionText, { fontSize: Math.max(13, 24 * scale), marginLeft: 12 * scale }]}>
        {label}
      </Text>
    </Pressable>
  );
}

export default function ProfilePremiumCanvas({
  availableWidth,
  topPadding,
  bottomPadding,
  username,
  bio,
  avatarUrl,
  hasRemoteAvatar,
  isAvatarEditingEnabled,
  isUpdatingAvatar,
  onAvatarPress,
  onAvatarError,
  growPoints,
  growCoins,
  stats,
  onEditProfile,
  onSettingsPress,
}) {
  const canvasWidth = Math.min(availableWidth, 430);
  const canvasHeight = canvasWidth / ART_ASPECT_RATIO;
  const scale = canvasWidth / ART_WIDTH;
  const avatarFrame = frame(canvasWidth, 305, 116, 245, 245);
  const rawCameraFrame = frame(canvasWidth, 381, 339, 91, 91);
  const cameraSize = Math.max(44, rawCameraFrame.width);
  const cameraFrame = {
    left: rawCameraFrame.left - (cameraSize - rawCameraFrame.width) / 2,
    top: rawCameraFrame.top - (cameraSize - rawCameraFrame.height) / 2,
    width: cameraSize,
    height: cameraSize,
  };
  const identityFrame = frame(canvasWidth, 82, 465, 689, 96);

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingTop: topPadding, paddingBottom: bottomPadding, alignItems: 'center' }}
        showsVerticalScrollIndicator={false}
      >
        <ImageBackground
          source={PROFILE_BACKGROUND}
          style={{ width: canvasWidth, height: canvasHeight }}
          resizeMode="contain"
        >
          <View style={[styles.avatarLayer, avatarFrame]}>
            <View style={[styles.avatarClip, { borderRadius: avatarFrame.width / 2 }]}>
              <Image
                source={hasRemoteAvatar ? { uri: avatarUrl } : GROW_AVATAR}
                style={hasRemoteAvatar ? styles.remoteAvatar : styles.defaultAvatar}
                resizeMode={hasRemoteAvatar ? 'cover' : 'contain'}
                onError={hasRemoteAvatar ? onAvatarError : undefined}
              />
              {isUpdatingAvatar ? (
                <View style={styles.avatarLoading}>
                  <ActivityIndicator color={COLORS.gold} />
                </View>
              ) : null}
            </View>
          </View>

          <Pressable
            disabled={!isAvatarEditingEnabled || isUpdatingAvatar}
            onPress={onAvatarPress}
            style={({ pressed }) => [
              styles.absoluteCenter,
              cameraFrame,
              styles.cameraTouch,
              { borderRadius: cameraSize / 2 },
              pressed && styles.actionPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Avatar ändern"
            accessibilityState={{ disabled: !isAvatarEditingEnabled || isUpdatingAvatar, busy: isUpdatingAvatar }}
          >
            <Ionicons name="camera-outline" size={Math.max(18, 31 * scale)} color={COLORS.softGold} />
          </Pressable>

          <View style={[styles.absoluteCenter, identityFrame, styles.identity]}>
            <Text
              style={[styles.username, { fontSize: Math.max(15, 40 * scale) }]}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {username}
            </Text>
            <Text
              style={[styles.bio, { fontSize: Math.max(9, 21 * scale), lineHeight: Math.max(12, 26 * scale) }]}
              numberOfLines={2}
            >
              {bio}
            </Text>
          </View>

          <BalanceContent canvasWidth={canvasWidth} icon={GROW_POINTS_ICON} value={growPoints} label="GROW Points" side="left" />
          <BalanceContent canvasWidth={canvasWidth} icon={GROW_COIN} value={growCoins} label="GROW Coins" side="right" />

          <Text
            style={[
              styles.statisticsHeading,
              frame(canvasWidth, 48, 850, 759, 52),
              { fontSize: Math.max(15, 30 * scale), lineHeight: Math.max(19, 37 * scale) },
            ]}
          >
            Statistiken
          </Text>

          {stats.map((item, index) => (
            <PremiumStat key={item.label} canvasWidth={canvasWidth} item={item} index={index} />
          ))}

          <ActionContent canvasWidth={canvasWidth} top={1539} icon="person-outline" label="Profil bearbeiten" onPress={onEditProfile} />
          <ActionContent canvasWidth={canvasWidth} top={1670} icon="settings-outline" label="Einstellungen" onPress={onSettingsPress} disabled={!onSettingsPress} />
        </ImageBackground>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.background },
  scroll: { flex: 1 },
  absoluteCenter: { position: 'absolute' },
  avatarLayer: { position: 'absolute', overflow: 'visible', zIndex: 10, elevation: 10 },
  avatarClip: { width: '100%', height: '100%', overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  remoteAvatar: { width: '100%', height: '100%' },
  defaultAvatar: { width: '90%', height: '90%' },
  avatarLoading: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(5,5,8,0.58)',
  },
  cameraTouch: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: '#08060B',
    borderWidth: 1.5,
    borderColor: COLORS.gold,
    zIndex: 30,
    elevation: 30,
  },
  identity: { alignItems: 'center', justifyContent: 'center' },
  username: { maxWidth: '94%', color: '#FFF5DE', fontWeight: '800', textAlign: 'center' },
  bio: { maxWidth: '88%', marginTop: 2, color: 'rgba(239,231,242,0.76)', textAlign: 'center' },
  balanceContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  balanceText: { justifyContent: 'center', marginLeft: 8 },
  balanceValue: { color: '#FFF5DE', fontWeight: '900' },
  balanceLabel: { marginTop: 2, color: 'rgba(231,220,235,0.72)', fontWeight: '700' },
  statisticsHeading: { position: 'absolute', color: '#FFF5DE', fontWeight: '800', textAlign: 'center', textAlignVertical: 'center' },
  statContent: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  statValue: { maxWidth: '92%', color: '#FFF5DE', fontWeight: '900', textAlign: 'center' },
  statLabel: { maxWidth: '94%', color: 'rgba(231,220,235,0.76)', fontWeight: '600', textAlign: 'center' },
  actionContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  actionText: { color: '#FFF5DE', fontWeight: '800' },
  actionDisabled: { opacity: 0.58 },
  actionPressed: { opacity: 0.76 },
});
