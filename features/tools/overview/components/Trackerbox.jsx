import { StyleSheet, Text, View } from 'react-native';
import { COLORS } from '../../../../constants/colors';
import { s, sv, sf } from '../../../../constants/layout'
 
export default function TrackerBox({ value, label }) {
  return (
    <View style={styles.box}>
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flex: 1,
    backgroundColor: '#08060B',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.075)',
    borderRadius: s(8),
    minHeight: sv(52),
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: s(6),
    paddingVertical: sv(8),
  },

  value: {
    color: '#FFF1D2',
    fontSize: sf(15.2),
    fontWeight: '500',
    marginBottom: sv(4),
    letterSpacing: 0.15,
  },

  label: {
    color: 'rgba(255,241,210,0.50)',
    fontSize: sf(9.2),
    fontWeight: '400',
    textAlign: 'center',
    lineHeight: sf(12.5),
  },
});