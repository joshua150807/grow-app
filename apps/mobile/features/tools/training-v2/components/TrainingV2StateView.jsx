import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { COLORS } from '../../../../constants/colors';
import { styles } from '../styles/trainingV2Styles';

export function TrainingV2StateView({ loading, error, onRetry }) {
  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={COLORS.softGold} size="large" />
        <Text style={styles.loadingText}>Trainingsdaten werden geladen …</Text>
      </View>
    );
  }

  if (!error) return null;
  return (
    <View style={styles.centered}>
      <Text style={styles.errorText}>{error.message}</Text>
      <Pressable accessibilityRole="button" onPress={onRetry} style={styles.retryButton}>
        <Text style={styles.retryText}>Erneut versuchen</Text>
      </Pressable>
    </View>
  );
}

