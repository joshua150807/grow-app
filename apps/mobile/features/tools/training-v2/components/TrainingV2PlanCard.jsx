import { Image, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { COLORS } from '../../../../constants/colors';
import { s } from '../../../../constants/layout';
import { styles } from '../styles/trainingV2Styles';

// No plan carries a real image today (no such field exists in the persisted model), so this
// stays undefined everywhere it's used — every card shows the same neutral placeholder below.
// It exists purely so a future real image source can be plugged in without restructuring the
// card itself.
function PlanThumbnail({ imageSource }) {
  if (imageSource) {
    return <Image source={imageSource} style={styles.planThumbnail} resizeMode="cover" />;
  }
  return (
    <View style={styles.planThumbnailPlaceholder}>
      <Ionicons name="barbell-outline" size={s(20)} color={COLORS.softGold} />
    </View>
  );
}

export function TrainingV2PlanCard({ plan, onPress, imageSource }) {
  const isActive = plan.status === 'active';
  // The IANA time zone is a technical raw value, not something a user reads at a glance, so
  // only the local start date is shown here — the full schedule remains on the detail screen.
  const metaText = [
    plan.weeklyGoal !== null ? `${plan.weeklyGoal}x/Woche` : null,
    plan.schedule ? `Start ${plan.schedule.startDate}` : null,
  ].filter(Boolean).join(' · ');

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => onPress(plan.id)}
      style={({ pressed }) => [
        styles.planCard,
        isActive && styles.planCardActive,
        pressed && styles.planCardPressed,
      ]}
    >
      <View style={styles.cardRow}>
        <PlanThumbnail imageSource={imageSource} />

        <View style={styles.cardBody}>
          <View style={styles.cardTop}>
            <Text style={styles.cardName} numberOfLines={2} ellipsizeMode="tail">
              {plan.name}
            </Text>
            {/* scheduled/draft never get a badge here — only the single active plan does. */}
            {isActive ? (
              <View style={[styles.statusBadge, styles.statusBadgeActive]}>
                <Ionicons name="flash" size={s(11)} color={COLORS.nearBlack} />
                <Text style={[styles.statusBadgeText, styles.statusBadgeTextActive]}>Aktiv</Text>
              </View>
            ) : null}
          </View>

          {metaText ? (
            <View style={styles.metaRow}>
              <Ionicons name="calendar-outline" size={s(12)} color={COLORS.textMuted} />
              <Text style={styles.meta} numberOfLines={1}>{metaText}</Text>
            </View>
          ) : null}
        </View>

        <Ionicons name="chevron-forward" size={s(16)} color={COLORS.softGold} style={styles.cardChevron} />
      </View>
    </Pressable>
  );
}
