import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { COLORS } from '../../constants/colors';
import { s, sv, sf } from '../../constants/layout';
import PressableScale from './PressableScale';

export default function ToolStateCard({
  icon = 'sparkles-outline',
  title,
  subtitle,
  loading = false,
  actionLabel,
  onAction,
  tone = 'default',
}) {
  const isError = tone === 'error';
  const iconColor = isError ? COLORS.errorLight : COLORS.textDim;

  return (
    <View style={[styles.card, isError && styles.errorCard]}>
      {loading ? (
        <ActivityIndicator color={COLORS.gold} />
      ) : (
        <View style={[styles.iconCircle, isError && styles.errorIconCircle]}>
          <Ionicons name={icon} size={s(30)} color={iconColor} />
        </View>
      )}

      {title ? <Text style={styles.title}>{title}</Text> : null}
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}

      {actionLabel && onAction ? (
        <PressableScale
          onPress={onAction}
          style={styles.actionButton}
          activeScale={0.975}
          activeOpacity={0.88}
          haptic="light"
        >
          <Text style={styles.actionText}>{actionLabel}</Text>
        </PressableScale>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: sv(34),
    paddingHorizontal: s(18),
    borderRadius: s(18),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.025)',
    gap: sv(8),
    marginBottom: sv(12),
  },
  errorCard: {
    borderColor: 'rgba(255,122,122,0.25)',
    backgroundColor: 'rgba(212,106,106,0.08)',
  },
  iconCircle: {
    width: s(54),
    height: s(54),
    borderRadius: s(27),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  errorIconCircle: {
    backgroundColor: 'rgba(212,106,106,0.12)',
    borderColor: 'rgba(255,122,122,0.25)',
  },
  title: {
    color: COLORS.textSecondary,
    fontSize: sf(16),
    fontWeight: '700',
    textAlign: 'center',
  },
  subtitle: {
    color: COLORS.textDim,
    fontSize: sf(13),
    textAlign: 'center',
    lineHeight: sf(19),
    maxWidth: s(260),
  },
  actionButton: {
    marginTop: sv(8),
    minHeight: sv(42),
    paddingHorizontal: s(18),
    borderRadius: s(12),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.gold,
  },
  actionText: {
    color: COLORS.background,
    fontSize: sf(14),
    fontWeight: '800',
  },
});