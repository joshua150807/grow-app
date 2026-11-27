import { Image, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';

import { COLORS } from '../../../../constants/colors';
import { TRAINING_V2_HUB_ICONS } from '../../../../constants/toolAssets';
import { TrainingV2StateView } from '../components/TrainingV2StateView';
import { useTrainingV2Plans } from '../hooks/useTrainingV2Plans';
import { styles } from '../styles/trainingV2Styles';

export default function TrainingV2HubScreen() {
  const { plans, initialLoading, error, retry, refreshing, refresh } = useTrainingV2Plans();
  const hasPlans = plans.length > 0;

  // useTrainingV2Plans refetches in the background on every focus (including returning from
  // a card, e.g. via an interactive iOS swipe-back that can tear down and recreate this
  // screen's own state). Its module-level cache means a fresh instance already starts with
  // the last successful `plans`, so `initialLoading` is only ever true for a genuine first
  // load with nothing cached yet — that is the one case allowed to replace the hub with the
  // fullscreen state view. A background refetch failure while plans are already showing must
  // not tear the hub down either; it only takes over fullscreen when there is truly nothing
  // to show, so an error is never silently dropped.
  if (initialLoading) {
    return (
      <View style={[styles.screen, styles.content]}>
        <TrainingV2StateView loading={initialLoading} error={hasPlans ? null : error} onRetry={retry} />
        <LegacyTrainingLink />
      </View>
    );
  }

  const openMyTraining = () => {
    router.push({ pathname: '/tools/training-v2-my-training' });
  };

  const openPlans = () => {
    router.push({ pathname: '/tools/training-v2-plans' });
  };

  const openLibrary = () => {
    router.push({ pathname: '/tools/training-v2-library' });
  };

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      refreshControl={(
        <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={COLORS.softGold} />
      )}
      style={styles.screen}
    >
      <Text style={styles.title}>Trainingsplan</Text>
      <Text style={styles.subtitle}>Wähle deinen Bereich.</Text>
      {error ? <TrainingV2StateView error={error} onRetry={retry} /> : null}

      <HubCard
        icon={TRAINING_V2_HUB_ICONS.myTraining}
        title="Mein Training"
        description="Starte dein Training, verfolge deinen Fortschritt und sieh dir deinen Plan an."
        onPress={openMyTraining}
      />
      <HubCard
        icon={TRAINING_V2_HUB_ICONS.plans}
        title="Trainingspläne"
        description="Entdecke fertige Pläne für dein Ziel oder erstelle deinen eigenen individuellen Plan."
        onPress={openPlans}
      />
      <HubCard
        icon={TRAINING_V2_HUB_ICONS.library}
        title="Übungsbibliothek"
        description="Finde Übungen, lerne die richtige Ausführung und verstehe deine Muskeln besser."
        onPress={openLibrary}
      />
      <LegacyTrainingLink />
    </ScrollView>
  );
}

function HubCard({ icon, title, description, onPress }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.hubCard}>
      <View style={styles.hubIconWrap}>
        <Image source={icon} style={styles.hubIconImage} resizeMode="contain" />
      </View>
      <View style={styles.hubCardTextWrap}>
        <Text style={styles.hubCardTitle}>{title}</Text>
        <Text style={styles.hubCardDescription}>{description}</Text>
      </View>
      <Text style={styles.hubCardChevron}>›</Text>
    </Pressable>
  );
}

// V1 has no per-set completion/load-type data. Keep its original owner-scoped
// plans/history usable, without copying data or inventing V2 record values.
function LegacyTrainingLink() {
  return (
    <Pressable accessibilityRole="button" onPress={() => router.push('/tools/training-legacy')} style={styles.retryButton}>
      <Text style={styles.retryText}>Bisheriger Trainingsplan & Verlauf</Text>
    </Pressable>
  );
}
