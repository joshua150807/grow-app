import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { COLORS } from '../../../../constants/colors';
import { s } from '../../../../constants/layout';
import { styles } from '../styles/trainingV2Styles';

// An active-but-unsaved Grow instance is only ever shown here, never in "Gespeicherte
// Pläne" (see selectTrainingV2SavedPlans in trainingV2ViewModel.js) — so this card is the
// only place that state is visible at all, and needs its own "Aktiv" badge for it. Every
// other card here (saved, or never touched) renders no badge.
export function TrainingV2TemplateCard({ item, onPress }) {
  const { template, userPlan } = item;
  const isActive = userPlan.isActive;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => onPress(template.id)}
      style={({ pressed }) => [
        styles.planCard,
        isActive && styles.planCardActive,
        pressed && styles.planCardPressed,
      ]}
    >
      <View style={styles.cardRow}>
        <View style={styles.planThumbnailPlaceholder}>
          <Ionicons name="barbell-outline" size={s(20)} color={COLORS.softGold} />
        </View>

        <View style={styles.cardBody}>
          <View style={styles.cardTop}>
            <Text style={styles.cardName} numberOfLines={2} ellipsizeMode="tail">
              {template.name}
            </Text>
            {isActive ? (
              <View style={[styles.statusBadge, styles.statusBadgeActive]}>
                <Ionicons name="flash" size={s(11)} color={COLORS.nearBlack} />
                <Text style={[styles.statusBadgeText, styles.statusBadgeTextActive]}>Aktiv</Text>
              </View>
            ) : null}
          </View>
          {template.description ? (
            <View style={styles.metaRow}>
              <Text style={styles.meta} numberOfLines={2}>{template.description}</Text>
            </View>
          ) : null}
        </View>

        <Ionicons name="chevron-forward" size={s(16)} color={COLORS.softGold} style={styles.cardChevron} />
      </View>
    </Pressable>
  );
}
