import { ImageBackground, StyleSheet, Text, View } from 'react-native';
import { s, sv, sf } from '../../../../constants/layout';
import { TRACKER_BG } from '../../../../constants/toolAssets';

export default function TrackerBox({ value, label }) {
  return (
    <ImageBackground
      source={TRACKER_BG}
      style={styles.box}
      imageStyle={styles.boxImage}
      resizeMode="stretch"
    >
      <View style={styles.overlay}>
        <Text style={styles.value}>{value}</Text>
        <Text style={styles.label}>{label}</Text>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  box: {
    flex: 1,
    minHeight: sv(52),
    borderRadius: s(8),
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },

  boxImage: {
    borderRadius: s(8),
  },

  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: s(6),
    paddingVertical: sv(8),
    backgroundColor: 'rgba(0,0,0,0.18)',
  },

  value: {
    color: '#FFF1D2',
    fontSize: sf(15.2),
    fontWeight: '500',
    marginBottom: sv(4),
    letterSpacing: 0.15,
  },

  label: {
    color: 'rgba(255,241,210,0.58)',
    fontSize: sf(9.2),
    fontWeight: '400',
    textAlign: 'center',
    lineHeight: sf(12.5),
  },
});
