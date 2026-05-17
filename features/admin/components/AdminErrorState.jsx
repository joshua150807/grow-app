import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { COLORS } from '../../../constants/colors';
import { s, sv, sf } from '../../../constants/layout';

export default function AdminErrorState({ title = 'Fehler', message }) {
  return (
    <View style={styles.centerScreen}>
      <Ionicons name="alert-circle-outline" size={s(42)} color={COLORS.error} />
      <Text style={styles.errorTitle}>{title}</Text>
      {!!message && <Text style={styles.errorText}>{message}</Text>}
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
  errorTitle: {
    color: COLORS.error,
    fontSize: sf(17),
    fontWeight: '800',
    marginTop: sv(12),
    textAlign: 'center',
  },
  errorText: {
    color: COLORS.textSecondary,
    fontSize: sf(13),
    marginTop: sv(8),
    textAlign: 'center',
    lineHeight: sf(18),
  },
});