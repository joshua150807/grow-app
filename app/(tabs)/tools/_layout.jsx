import { Dimensions, Platform } from 'react-native';
import { Stack } from 'expo-router';

import { COLORS } from '../../../constants/colors';

const SWIPE_BACK_GESTURE_DISTANCE = Math.round(Dimensions.get('window').width / 3);

export default function ToolsLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: {
          backgroundColor: COLORS.background,
        },
        animation: Platform.OS === 'ios' ? 'ios_from_right' : 'slide_from_right',
        gestureEnabled: true,
        fullScreenGestureEnabled: false,
        gestureResponseDistance: SWIPE_BACK_GESTURE_DISTANCE,
      }}
    />
  );
}
