import { ImageBackground, View, Text, Pressable, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { COLORS } from '../../../../constants/colors';
import { DEEPWORK_PAGE_BG } from '../../../../constants/toolAssets';
import { s } from '../../../../constants/layout';
import { styles } from '../styles/deepWorkStyles';

export default function DeepWorkIdleView({ router, openSetup, phase }) {
  return (
    <ImageBackground
      source={DEEPWORK_PAGE_BG}
      style={styles.screen}
      imageStyle={styles.deepWorkPageBackgroundImage}
      resizeMode="cover"
    >
      <View style={styles.pageOverlay} pointerEvents="none" />
      <View style={styles.topBar}>
        <Pressable
          onPress={() => {
            if (phase !== 'running') {
              router.back();
            }
          }}
          hitSlop={10}
          style={({ pressed }) => [
            styles.backButton,
            pressed && styles.subtlePressed,
          ]}
        >
          <Ionicons name="chevron-back" size={s(24)} color={COLORS.softGold} />
          <Text style={styles.backText}>Tools</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.idleContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.title}>DEEP WORK</Text>
          <Text style={styles.subtitle}>Disziplin. Fokus. Keine Ablenkung.</Text>
        </View>

        <View style={styles.infoCard}>
          <Ionicons
            name="information-circle-outline"
            size={s(18)}
            color={COLORS.gold}
          />
          <Text style={styles.infoText}>
            Starte eine fokussierte Arbeitseinheit ohne Unterbrechungen.
          </Text>
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.startButton,
            pressed && styles.primaryButtonPressed,
          ]}
          onPress={openSetup}
        >
          <Ionicons name="play" size={s(20)} color={COLORS.black} />
          <Text style={styles.startButtonText}>Session starten</Text>
        </Pressable>
      </ScrollView>
    </ImageBackground>
  );
}