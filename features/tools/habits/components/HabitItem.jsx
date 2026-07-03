import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { COLORS } from '../../../../constants/colors';
import { s, sv, sf } from '../../../../constants/layout';
import PressableScale from '../../../../components/ui/PressableScale';
import { triggerHaptic } from '../../../../lib/haptics';

export function HabitItem({
  habit,
  selectedDay,
  done,
  onToggle,
  onDelete,
  onEdit,
  onOpenLinkedTool,
}) {
  const hasLinkedTool = Boolean(habit.linked_tool_route && habit.linked_tool_title);

  const handleToggle = () => {
    void triggerHaptic(done ? 'selection' : 'light');
    onToggle(habit.id);
  };

  return (
    <View
      style={[
        styles.habitCard,
        hasLinkedTool ? styles.habitCardWithLinkedTool : styles.habitCardWithoutLinkedTool,
        done && styles.habitCardDone,
      ]}
    >
      <View
        style={[
          styles.habitMainRow,
          hasLinkedTool ? styles.habitMainRowWithLinkedTool : styles.habitMainRowWithoutLinkedTool,
        ]}
      >
        <View
          style={[
            styles.habitLeft,
            hasLinkedTool ? styles.habitLeftWithLinkedTool : styles.habitLeftWithoutLinkedTool,
          ]}
        >
          <PressableScale
            style={styles.checkboxTapArea}
            activeScale={0.92}
            activeOpacity={0.86}
            onPressIn={handleToggle}
            hitSlop={{ top: s(8), bottom: s(8), left: s(8), right: s(8) }}
            pressRetentionOffset={{ top: s(24), bottom: s(24), left: s(24), right: s(24) }}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: !!done }}
          >
            <View pointerEvents="none" style={[styles.checkbox, done && styles.checkboxDone]}>
              {done && (
                <Ionicons name="checkmark" size={s(13)} color={COLORS.black} />
              )}
            </View>
          </PressableScale>

          <View style={styles.habitTextWrap}>
            <Pressable
              style={({ pressed }) => [
                styles.habitTitlePressable,
                pressed && styles.habitTitlePressed,
              ]}
              onPress={handleToggle}
            >
              <Text
                style={[styles.habitTitle, done && styles.habitTitleDone]}
                numberOfLines={2}
              >
                {habit.name}
              </Text>
            </Pressable>

            {hasLinkedTool && (
              <Pressable
                style={styles.linkedToolButton}
                onPress={(event) => {
                  event.stopPropagation();
                  onOpenLinkedTool?.(habit);
                }}
                hitSlop={s(6)}
              >
                <Ionicons name="link-outline" size={s(13)} color={COLORS.gold} />
                <Text style={styles.linkedToolText} numberOfLines={1}>
                  {habit.linked_tool_title} öffnen
                </Text>
              </Pressable>
            )}
          </View>
        </View>

        <View style={styles.habitRight}>
          <View style={styles.habitDayDots}>
            {habit.days.map((day) => (
              <View
                key={day}
                style={[
                  styles.dayDot,
                  day === selectedDay && styles.dayDotActive,
                ]}
              />
            ))}
          </View>

          <View style={styles.actionRow}>
            <PressableScale
              style={styles.actionBtn}
              activeScale={0.92}
              activeOpacity={0.84}
              onPress={() => onEdit?.(habit)}
              hitSlop={s(8)}
            >
              <Ionicons name="create-outline" size={s(17)} color={COLORS.gold} />
            </PressableScale>

            {done && (
              <PressableScale
                style={styles.trashBtn}
                activeScale={0.92}
                activeOpacity={0.82}
                onPress={() => {
                  void triggerHaptic('medium');
                  onDelete(habit.id);
                }}
                hitSlop={s(8)}
              >
                <Ionicons name="trash-outline" size={s(16)} color={COLORS.white} />
              </PressableScale>
            )}
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  habitCard: {
    minHeight: sv(70),
    borderRadius: s(14),
    borderWidth: 1,
    borderColor: COLORS.goldBorder,
    backgroundColor: 'rgba(10,10,12,0.72)',
    paddingHorizontal: s(14),
    paddingVertical: sv(12),
  },
  habitCardWithoutLinkedTool: {
    justifyContent: 'center',
  },
  habitCardWithLinkedTool: {
    justifyContent: 'center',
    minHeight: sv(88),
  },
  habitCardDone: {
    backgroundColor: 'rgba(212,175,55,0.08)',
    borderColor: 'rgba(212,175,55,0.28)',
  },
  habitMainRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: s(12),
  },
  habitMainRowWithoutLinkedTool: {
    alignItems: 'center',
  },
  habitMainRowWithLinkedTool: {
    alignItems: 'flex-start',
  },
  habitLeft: {
    flex: 1,
    flexDirection: 'row',
    gap: s(12),
  },
  habitLeftWithoutLinkedTool: {
    alignItems: 'center',
  },
  habitLeftWithLinkedTool: {
    alignItems: 'flex-start',
  },
  checkboxTapArea: {
    width: s(44),
    height: s(44),
    marginVertical: sv(-10),
    marginRight: s(-7),
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  checkbox: {
    width: s(24),
    height: s(24),
    borderRadius: s(6),
    borderWidth: 1.5,
    borderColor: COLORS.goldBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxDone: {
    backgroundColor: COLORS.gold,
    borderColor: COLORS.gold,
  },
  habitTextWrap: {
    flex: 1,
  },
  habitTitlePressable: {
    borderRadius: s(10),
    paddingVertical: sv(3),
  },
  habitTitlePressed: {
    opacity: 0.72,
  },
  habitTitle: {
    color: COLORS.white,
    fontSize: sf(15),
    fontWeight: '800',
  },
  habitTitleDone: {
    color: COLORS.textDim,
    textDecorationLine: 'line-through',
  },
  linkedToolButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(5),
    marginTop: sv(7),
    paddingHorizontal: s(9),
    paddingVertical: sv(5),
    borderRadius: s(999),
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.32)',
    backgroundColor: 'rgba(212,175,55,0.08)',
  },
  linkedToolText: {
    maxWidth: s(160),
    color: COLORS.softGold,
    fontSize: sf(11),
    fontWeight: '800',
  },
  habitRight: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: sv(8),
  },
  habitDayDots: {
    flexDirection: 'row',
    gap: s(4),
  },
  dayDot: {
    width: s(5),
    height: s(5),
    borderRadius: s(999),
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  dayDotActive: {
    backgroundColor: COLORS.gold,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(6),
  },
  actionBtn: {
    width: s(28),
    height: s(28),
    borderRadius: s(14),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(212,175,55,0.10)',
  },
  trashBtn: {
    width: s(28),
    height: s(28),
    borderRadius: s(14),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
});
