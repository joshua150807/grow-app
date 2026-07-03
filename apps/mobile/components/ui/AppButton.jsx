import { StyleSheet, Text } from 'react-native';
import { COLORS } from '../../constants/colors';
import { s, sv, sf } from '../../constants/layout';
import PressableScale from './PressableScale';
 
export default function AppButton({ title, onPress, disabled = false, style, textStyle, haptic = null }) {
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      activeScale={0.975}
      activeOpacity={0.88}
      haptic={haptic}
      style={[styles.button, disabled && styles.disabled, style]}
    >
      <Text style={[styles.text, textStyle]}>{title}</Text>
    </PressableScale>
  );
}
 
const styles = StyleSheet.create({
  button: {
    minHeight: sv(36),
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.goldBorderLight,
    backgroundColor: COLORS.darkCard3,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: s(16),
  },
  disabled: { opacity: 0.65 },
  text: {
    color: COLORS.lightGold,
    fontSize: sf(13),
    fontWeight: '700',
  },
});