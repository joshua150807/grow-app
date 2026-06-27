import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { COLORS } from '../../../../constants/colors';
import { s } from '../../../../constants/layout';
import PressableScale from '../../../../components/ui/PressableScale';
import { styles } from '../styles/leitfragenStyles';

export default function LeitfragenPageNavigation({
  questionPage,
  onPreviousPage,
  onNextPage,
}) {
  return (
    <View style={styles.pageNavCard}>
      <PressableScale onPress={onPreviousPage} style={styles.pageArrowButton} activeScale={0.94}>
        <Ionicons name="chevron-back" size={s(24)} color={COLORS.softGold} />
      </PressableScale>

      <View style={styles.pageNavCenter}>
        <Text style={styles.pageNavQuestionNumber} numberOfLines={1}>
          {questionPage?.eyebrow}
        </Text>
      </View>

      <PressableScale onPress={onNextPage} style={styles.pageArrowButton} activeScale={0.94}>
        <Ionicons name="chevron-forward" size={s(24)} color={COLORS.softGold} />
      </PressableScale>
    </View>
  );
}
