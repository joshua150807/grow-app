import { ImageBackground, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { COLORS } from '../../../../constants/colors';
import { s } from '../../../../constants/layout';
import { TRAINING_V2_CREATE_PLAN_HERO } from '../../../../constants/toolAssets';
import { TrainingV2PlanSections } from '../components/TrainingV2PlanSections';
import { TrainingV2StateView } from '../components/TrainingV2StateView';
import { useTrainingV2Plans } from '../hooks/useTrainingV2Plans';
import { useTrainingV2Templates } from '../hooks/useTrainingV2Templates';
import { selectTrainingV2SavedPlans } from '../models/trainingV2ViewModel';
import { styles } from '../styles/trainingV2Styles';

export default function TrainingV2PlansScreen() {
  const { plans, loading: plansLoading, refreshing: plansRefreshing, error: plansError, retry: retryPlans, refresh: refreshPlans } = useTrainingV2Plans();
  const { templates, loading: templatesLoading, error: templatesError, retry: retryTemplates, refresh: refreshTemplates } = useTrainingV2Templates();

  const loading = plansLoading || templatesLoading;
  const error = plansError || templatesError;

  if (loading || error) {
    return (
      <TrainingV2StateView
        loading={loading}
        error={error}
        onRetry={() => { void retryPlans(); void retryTemplates(); }}
      />
    );
  }

  const openEditor = () => router.push({ pathname: '/tools/training-v2-plan-editor' });

  const savedPlans = selectTrainingV2SavedPlans(plans);

  const openTemplateDetail = (templateId) => router.push({
    pathname: '/tools/training-v2-plan-detail',
    params: { templateId },
  });

  const openPlanDetail = (planId) => {
    const plan = savedPlans.find((candidate) => candidate.id === planId);
    if (plan?.sourceTemplateId) {
      openTemplateDetail(plan.sourceTemplateId);
      return;
    }
    router.push({ pathname: '/tools/training-v2-plan-detail', params: { planId } });
  };

  const onRefresh = () => { void refreshPlans(); void refreshTemplates(); };

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      refreshControl={(
        <RefreshControl
          refreshing={plansRefreshing}
          onRefresh={onRefresh}
          tintColor={COLORS.softGold}
        />
      )}
      style={styles.screen}
    >
      <View style={styles.plansHeaderRow}>
        <Pressable onPress={() => router.back()} style={styles.plansBackRow} hitSlop={8}>
          <Ionicons name="chevron-back" size={s(20)} color={COLORS.softGold} />
          <Text style={styles.backText}>Zurück</Text>
        </Pressable>
        <Text style={styles.plansHeaderTitle} numberOfLines={1}>Trainingspläne</Text>
      </View>
      <Text style={styles.subtitle}>Deine Trainingspläne im Überblick.</Text>

      <Pressable
        accessibilityRole="button"
        onPress={openEditor}
        style={({ pressed }) => [styles.heroCard, pressed && styles.heroCardPressed]}
      >
        <ImageBackground
          source={TRAINING_V2_CREATE_PLAN_HERO}
          style={styles.heroImage}
          imageStyle={styles.heroImageInner}
          resizeMode="cover"
        >
          <View style={styles.heroTextWrap}>
            <Text style={styles.heroTitle}>Eigenen Plan erstellen</Text>
            <Text style={styles.heroSubtitle}>
              Erstelle deinen individuellen Trainingsplan nach deinen Vorstellungen.
            </Text>
          </View>
        </ImageBackground>
      </Pressable>

      <TrainingV2PlanSections
        templates={templates}
        savedPlans={savedPlans}
        onTemplatePress={openTemplateDetail}
        onPlanPress={openPlanDetail}
      />
    </ScrollView>
  );
}
