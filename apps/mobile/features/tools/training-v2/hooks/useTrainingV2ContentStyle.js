import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { s, sv } from '../../../../constants/layout';
import { styles } from '../styles/trainingV2Styles';

// Keep the existing spacing, expanding it for a notch, landscape inset and the
// floating tab bar (68 + 24 points of clearance). No fixed viewport/card height.
export function useTrainingV2ContentStyle() {
  const insets = useSafeAreaInsets();
  return [styles.content, {
    paddingTop: Math.max(sv(72), insets.top + sv(20)),
    paddingBottom: Math.max(sv(120), insets.bottom + sv(92)),
    paddingLeft: Math.max(s(20), insets.left + s(16)),
    paddingRight: Math.max(s(20), insets.right + s(16)),
  }];
}
