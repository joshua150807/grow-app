import { useRef } from 'react';
import { Animated, Pressable } from 'react-native';
import { triggerHaptic } from '../../lib/haptics';

export default function PressableScale({
  children,
  style,
  disabled = false,
  activeScale = 0.985,
  activeOpacity = 0.92,
  animationSpeed = 130,
  haptic = null,
  onPress,
  onPressIn,
  onPressOut,
  ...props
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  const animateTo = (nextScale, nextOpacity) => {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: nextScale,
        speed: 38,
        bounciness: 0,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: nextOpacity,
        duration: animationSpeed,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handlePressIn = (event) => {
    if (!disabled) {
      animateTo(activeScale, activeOpacity);
    }
    onPressIn?.(event);
  };

  const handlePressOut = (event) => {
    if (!disabled) {
      animateTo(1, 1);
    }
    onPressOut?.(event);
  };

  const handlePress = (event) => {
    if (!disabled && haptic) {
      void triggerHaptic(haptic);
    }

    onPress?.(event);
  };

  return (
    <Pressable
      {...props}
      disabled={disabled}
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
    >
      <Animated.View
        style={[
          style,
          {
            opacity,
            transform: [{ scale }],
          },
        ]}
      >
        {children}
      </Animated.View>
    </Pressable>
  );
}