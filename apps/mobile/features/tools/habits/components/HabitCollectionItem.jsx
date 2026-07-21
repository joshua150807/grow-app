import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { COLORS } from '../../../../constants/colors';
import { s, sv, sf } from '../../../../constants/layout';
import PressableScale from '../../../../components/ui/PressableScale';
import { triggerHaptic } from '../../../../lib/haptics';

export function HabitCollectionItem({
  collection,
  completedCount,
  total,
  onPress,
}) {
  const isComplete = total > 0 && completedCount === total;

  const handlePress = () => {
    void triggerHaptic('light');
    onPress?.(collection);
  };

  return (
    <Pressable
      style={[styles.card, isComplete && styles.cardDone]}
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={`${collection.name}, ${completedCount} von ${total} erledigt`}
    >
      <View style={styles.mainRow}>
        <View style={styles.left}>
          <View style={styles.checkContainer}>
            <View style={[styles.checkIcon, isComplete && styles.checkIconDone]}>
              {isComplete && (
                <Ionicons name="checkmark" size={s(13)} color={COLORS.black} />
              )}
            </View>
          </View>

          <View style={styles.textWrap}>
            <View style={styles.titleRow}>
              <Text
                style={[styles.title, isComplete && styles.titleDone]}
                numberOfLines={2}
              >
                {collection.name}
              </Text>
              <Text style={styles.chevron}>›</Text>
            </View>
          </View>
        </View>

        <View style={styles.right}>
          <Text style={styles.progress}>
            {completedCount}/{total}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: sv(70),
    paddingHorizontal: s(14),
    paddingVertical: sv(12),
    backgroundColor: 'rgba(10,10,12,0.72)',
    borderRadius: s(14),
    borderWidth: 1,
    borderColor: COLORS.goldBorder,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardDone: {
    backgroundColor: 'rgba(212,175,55,0.08)',
    borderColor: 'rgba(212,175,55,0.28)',
  },
  mainRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    gap: s(12),
  },
  left: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(12),
  },
  checkContainer: {
    width: s(44),
    height: s(44),
    marginVertical: sv(-10),
    marginRight: s(-7),
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  checkIcon: {
    width: s(24),
    height: s(24),
    borderRadius: s(6),
    borderWidth: 1.5,
    borderColor: COLORS.goldBorder,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkIconDone: {
    backgroundColor: COLORS.gold,
    borderColor: COLORS.gold,
  },
  textWrap: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: sf(15),
    fontWeight: '800',
    color: COLORS.white,
    flex: 1,
  },
  titleDone: {
    color: COLORS.textDim,
    textDecorationLine: 'line-through',
  },
  chevron: {
    fontSize: sf(16),
    color: COLORS.textDim,
    marginLeft: s(8),
  },
  right: {
    marginLeft: s(12),
    alignItems: 'flex-end',
  },
  progress: {
    fontSize: sf(13),
    fontWeight: '600',
    color: COLORS.gold,
  },
});
