import { ImageBackground, Pressable, StyleSheet, Text, View } from 'react-native';
import { COLORS } from '../../../../constants/colors';
import { s, sv, sf, SCREEN } from '../../../../constants/layout';

const compact = SCREEN.height < 900;
const veryCompact = SCREEN.height < 700;

export default function ToolCard({
  icon,
  image,
  title,
  description,
  onPress,
  disabled = false,
  badgeText,
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        image && styles.imageCard,
        disabled && styles.cardDisabled,
        pressed && !disabled && styles.cardPressed,
      ]}
      onPress={onPress}
      disabled={disabled}
    >
      {image ? (
        <ImageBackground
          source={image}
          style={styles.imageBackground}
          imageStyle={styles.imageStyle}
          resizeMode="cover"
        >
          {badgeText ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{badgeText}</Text>
            </View>
          ) : null}

          <View style={styles.imageTextBox}>
            <Text style={[styles.imageTitle, disabled && styles.titleDisabled]} numberOfLines={1}>
              {title}
            </Text>

            {!!description && (
              <Text style={styles.imageDescription} numberOfLines={2}>
                {description}
              </Text>
            )}
          </View>
        </ImageBackground>
      ) : (
        <>
          {badgeText ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{badgeText}</Text>
            </View>
          ) : null}

          <View style={[styles.iconWrapper, disabled && styles.iconWrapperDisabled]}>
            {typeof icon === 'string' ? (
              <Text style={[styles.icon, disabled && styles.iconDisabled]}>{icon}</Text>
            ) : (
              icon
            )}
          </View>

          <Text style={[styles.title, disabled && styles.titleDisabled]} numberOfLines={2}>
            {title}
          </Text>

          {!!description && (
            <Text
              style={[styles.description, disabled && styles.descriptionDisabled]}
              numberOfLines={2}
            >
              {description}
            </Text>
          )}
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '31.5%',
    aspectRatio: 1,
    backgroundColor: '#08060B',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(51, 51, 51, 0.99)',
    borderRadius: s(8),
    paddingVertical: sv(8),
    paddingHorizontal: s(6),
    marginBottom: sv(8),
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },

  imageCard: {
    paddingVertical: 0,
    paddingHorizontal: 0,
    borderWidth: 0,
    backgroundColor: 'transparent',
  },

  cardDisabled: {
    borderColor: 'rgb(39, 39, 39)',
    backgroundColor: '#07050A',
    opacity: 0.78,
  },

  cardPressed: {
    transform: [{ scale: 0.985 }],
    opacity: 0.9,
  },

  imageBackground: {
    width: '100%',
    height: '100%',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },

  imageStyle: {
    borderRadius: s(8),
  },

  imageTextBox: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '54%',
    paddingHorizontal: s(6),
    alignItems: 'center',
    justifyContent: 'center',
  },

  imageTitle: {
    color: '#FFD978',
    fontSize: veryCompact ? sf(8.6) : compact ? sf(9.6) : sf(10.6),
    fontWeight: '800',
    textAlign: 'center',
    textTransform: 'none',
    letterSpacing: 0.1,
    textShadowColor: 'rgba(255, 217, 120, 0.75)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 6,
  },

  imageDescription: {
    marginTop: sv(3),
    color: 'rgba(255, 217, 120, 0.82)',
    fontSize: veryCompact ? sf(6) : compact ? sf(6.6) : sf(7.2),
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: veryCompact ? sf(7.8) : compact ? sf(8.5) : sf(9.2),

    textShadowColor: 'rgba(255, 217, 120, 0.45)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 4,
  },

  badge: {
    position: 'absolute',
    top: sv(8),
    right: s(8),
    paddingHorizontal: s(7),
    paddingVertical: sv(3),
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.025)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.10)',
  },

  badgeText: {
    color: 'rgba(255,241,210,0.68)',
    fontSize: sf(8.8),
    fontWeight: '400',
  },

  iconWrapper: {
    width: s(38),
    height: s(38),
    borderRadius: s(19),
    borderWidth: 0,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: sv(6),
    backgroundColor: 'transparent',

    shadowColor: COLORS.toolsGold,
    shadowOpacity: 0.28,
    shadowRadius: 7,
    shadowOffset: { width: 0, height: 0 },
    elevation: 2,
  },

  iconWrapperDisabled: {
    borderColor: 'transparent',
    backgroundColor: 'transparent',
    shadowOpacity: 0,
    elevation: 0,
  },

  iconElement: {
    alignItems: 'center',
    justifyContent: 'center',
  },

  icon: {
    color: COLORS.toolsGold,
    fontSize: sf(18),
    textShadowColor: 'rgba(231,201,138,0.35)',
    textShadowRadius: 6,
    textShadowOffset: { width: 0, height: 0 },
  },

  iconDisabled: {
    opacity: 0.42,
  },

  title: {
    color: '#FFF1D2',
    fontSize: sf(10.8),
    fontWeight: '500',
    marginBottom: sv(3),
    textAlign: 'center',
    letterSpacing: 0.15,
  },

  titleDisabled: {
    color: 'rgba(216,209,227,0.62)',
    fontWeight: '500',
  },

  description: {
    color: 'rgba(255,241,210,0.50)',
    fontSize: sf(8.4),
    fontWeight: '400',
    lineHeight: sf(11),
    textAlign: 'center',
  },

  descriptionDisabled: {
    color: 'rgba(216,209,227,0.38)',
  },
});