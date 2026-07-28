import { ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';

import { styles } from '../styles/trainingV2Styles';

export default function TrainingV2LibraryScreen() {
  return (
    <ScrollView contentContainerStyle={styles.content} style={styles.screen}>
      <View style={styles.topRow}>
        <Text onPress={() => router.back()} style={styles.backText}>‹ Zurück</Text>
        <Text style={styles.title}>Übungsbibliothek</Text>
      </View>
      <Text style={styles.subtitle}>Eigenständiger Bereich für Übungen.</Text>

      <View style={styles.emptyCard}>
        <Text style={styles.emptyTitle}>Bald verfügbar</Text>
        <Text style={styles.emptyText}>
          Die eigenständige Übungsbibliothek für Training V2 folgt in einem späteren Schritt.
        </Text>
      </View>
    </ScrollView>
  );
}
