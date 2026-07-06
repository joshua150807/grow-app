import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { COLORS } from '../../../constants/colors';
import { s, sv, sf } from '../../../constants/layout';

export default function AdminLoadingState({ text }) {
  return (
    <View style={styles.centerScreen}>
      <ActivityIndicator color={COLORS.softGold} />
      <Text style={styles.loadingText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  centerScreen: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: s(28),
  },
  loadingText: {
    marginTop: sv(14),
    color: COLORS.textSecondary,
    fontSize: sf(14),
  },
});