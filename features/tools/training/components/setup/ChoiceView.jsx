import { View, Text, ScrollView, Pressable } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { COLORS } from '../../../../../constants/colors';
import { s } from '../../../../../constants/layout';
import { styles } from '../../styles/trainingStyles';

export function ChoiceView({ onSelectPresets, onSelectCustom }) {
  return (
    <View style={styles.screen}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={s(24)} color={COLORS.softGold} />
          <Text style={styles.backText}>Tools</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.iconCircle}>
            <Ionicons name="barbell-outline" size={s(36)} color={COLORS.gold} />
          </View>
          <Text style={styles.title}>TRAININGSPLAN</Text>
          <Text style={styles.subtitle}>Wie möchtest du starten?</Text>
        </View>

        <Pressable style={styles.setupChoiceCard} onPress={onSelectPresets}>
          <View style={styles.setupChoiceCardIconWrap}>
            <Ionicons name="list-outline" size={s(24)} color={COLORS.gold} />
          </View>
          <View style={styles.setupChoiceCardContent}>
            <Text style={styles.setupChoiceCardTitle}>Plan auswählen</Text>
            <Text style={styles.setupChoiceCardDesc}>
              Wähle einen vorgefertigten Plan und starte direkt
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={s(20)} color={COLORS.textDim} />
        </Pressable>

        <Pressable style={styles.setupChoiceCard} onPress={onSelectCustom}>
          <View style={styles.setupChoiceCardIconWrap}>
            <Ionicons name="create-outline" size={s(24)} color={COLORS.gold} />
          </View>
          <View style={styles.setupChoiceCardContent}>
            <Text style={styles.setupChoiceCardTitle}>Eigenen Plan erstellen</Text>
            <Text style={styles.setupChoiceCardDesc}>
              Erstelle einen Plan nach deinen Vorstellungen
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={s(20)} color={COLORS.textDim} />
        </Pressable>
      </ScrollView>
    </View>
  );
}