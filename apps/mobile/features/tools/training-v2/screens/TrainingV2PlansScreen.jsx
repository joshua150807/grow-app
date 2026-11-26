import { Image, Pressable, RefreshControl, ScrollView, Text, View, useWindowDimensions } from 'react-native';
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
import { useTrainingV2ContentStyle } from '../hooks/useTrainingV2ContentStyle';

// Source artwork is 1200 × 546 px. Explicit point sizes (instead of width '100%' + aspectRatio)
// so the device never draws it at its pixel size; capped so it stays card-sized on wide screens.
const HERO_ASPECT = 546 / 1200;
const HERO_MAX_WIDTH = 640;

export default function TrainingV2PlansScreen() {
  const contentStyle = useTrainingV2ContentStyle();
  const { width: windowWidth } = useWindowDimensions();
  const { paddingLeft = 0, paddingRight = 0 } = contentStyle.at(-1) ?? {};
  const heroWidth = Math.max(0, Math.min(windowWidth - paddingLeft - paddingRight, HERO_MAX_WIDTH));
  const heroImageSize = { width: heroWidth, height: Math.round(heroWidth * HERO_ASPECT) };
  const heroTitleSize = { fontSize: Math.round(heroWidth * 0.042 * 10) / 10, lineHeight: Math.round(heroWidth * 0.052) };
  const heroSubtitleSize = { fontSize: Math.round(heroWidth * 0.03 * 10) / 10, lineHeight: Math.round(heroWidth * 0.039) };
  const { plans, loading: plansLoading, refreshing: plansRefreshing, error: plansError, retry: retryPlans, refresh: refreshPlans } = useTrainingV2Plans();
  const { templates, loading: templatesLoading, refreshing: templatesRefreshing, error: templatesError, retry: retryTemplates, refresh: refreshTemplates } = useTrainingV2Templates();

  const loading = plansLoading || templatesLoading;
  const error = plansError || templatesError;

  const hasContent = plans.length > 0 || templates.length > 0;
  if ((loading || error) && !hasContent) {
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

  const openTemplateDetail = (templateId, planId) => router.push({
    pathname: '/tools/training-v2-plan-detail',
    params: { templateId, ...(planId ? { planId } : {}) },
  });

  const openPlanDetail = (planId) => {
    const plan = savedPlans.find((candidate) => candidate.id === planId);
    if (plan?.sourceTemplateId) {
      openTemplateDetail(plan.sourceTemplateId, plan.id);
      return;
    }
    router.push({ pathname: '/tools/training-v2-plan-detail', params: { planId } });
  };

  const onRefresh = () => { void refreshPlans(); void refreshTemplates(); };

  return (
    <ScrollView
      contentContainerStyle={contentStyle}
      refreshControl={(
        <RefreshControl
          refreshing={Boolean(plansRefreshing || templatesRefreshing)}
          onRefresh={onRefresh}
          tintColor={COLORS.softGold}
        />
      )}
      style={styles.screen}
    >
      <View style={styles.plansHeaderRow}>
        <Pressable accessibilityRole="button" accessibilityLabel="Zurück" onPress={() => router.back()} style={styles.plansBackRow}>
          <Ionicons name="chevron-back" size={s(20)} color={COLORS.softGold} />
          <Text style={styles.backText}>Zurück</Text>
        </Pressable>
        <Text accessibilityRole="header" style={styles.plansHeaderTitle}>Trainingspläne</Text>
      </View>
      <Text style={[styles.subtitle, styles.plansCenteredText]}>Deine Trainingspläne im Überblick.</Text>
      {error ? <TrainingV2StateView error={error} onRetry={() => { void retryPlans(); void retryTemplates(); }} /> : null}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Eigenen Plan erstellen"
        onPress={openEditor}
        style={({ pressed }) => [styles.heroCard, pressed && styles.heroCardPressed]}
      >
        <View style={[styles.heroImage, heroImageSize]}>
          <Image
            source={TRAINING_V2_CREATE_PLAN_HERO}
            style={heroImageSize}
            resizeMode="contain"
          />
          {/* Caption sits in the artwork's empty middle: right of the pencil circle, left of the
              athlete/arrow, inside the gold frame. Font sizes follow the image width so it fits. */}
          <View style={styles.heroTextWrap}>
            <Text maxFontSizeMultiplier={1.1} style={[styles.heroTitle, heroTitleSize]}>Eigenen Plan erstellen</Text>
            <Text maxFontSizeMultiplier={1.1} style={[styles.heroSubtitle, heroSubtitleSize]}>
              Erstelle deinen individuellen Trainingsplan nach deinen Vorstellungen.
            </Text>
          </View>
        </View>
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
