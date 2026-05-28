import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

export const HAPTIC_TYPE = {
  selection: 'selection',
  light: 'light',
  medium: 'medium',
  heavy: 'heavy',
  success: 'success',
  warning: 'warning',
  error: 'error',
};

export async function triggerHaptic(type = HAPTIC_TYPE.light) {
  if (Platform.OS === 'web') return;

  try {
    if (type === HAPTIC_TYPE.selection) {
      await Haptics.selectionAsync();
      return;
    }

    if (type === HAPTIC_TYPE.success) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      return;
    }

    if (type === HAPTIC_TYPE.warning) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }

    if (type === HAPTIC_TYPE.error) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    const impactMap = {
      [HAPTIC_TYPE.light]: Haptics.ImpactFeedbackStyle.Light,
      [HAPTIC_TYPE.medium]: Haptics.ImpactFeedbackStyle.Medium,
      [HAPTIC_TYPE.heavy]: Haptics.ImpactFeedbackStyle.Heavy,
    };

    await Haptics.impactAsync(impactMap[type] ?? Haptics.ImpactFeedbackStyle.Light);
  } catch (error) {
    // Haptics can silently fail on unsupported devices/simulators. Ignore it.
  }
}