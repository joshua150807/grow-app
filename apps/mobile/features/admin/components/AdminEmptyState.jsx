import { StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { COLORS } from '../../../constants/colors';
import { s, sv, sf } from '../../../constants/layout';

export default function AdminEmptyState({
  icon = 'inbox',
  title,
  text,
}) {
  return (
    <View style={styles.emptyBox}>
      <Feather name={icon} size={s(28)} color={COLORS.softGold} />
      {!!title && <Text style={styles.emptyTitle}>{title}</Text>}
      {!!text && <Text style={styles.emptyText}>{text}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  emptyBox: {
    backgroundColor: COLORS.darkCard2,
    borderRadius: s(18),
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
    padding: s(18),
    alignItems: 'center',
    marginTop: sv(16),
  },
  emptyTitle: {
    color: COLORS.paleGold,
    fontSize: sf(16),
    fontWeight: '800',
    marginTop: sv(10),
  },
  emptyText: {
    color: COLORS.textSecondary,
    fontSize: sf(13),
    textAlign: 'center',
    marginTop: sv(6),
    lineHeight: sf(19),
  },
});