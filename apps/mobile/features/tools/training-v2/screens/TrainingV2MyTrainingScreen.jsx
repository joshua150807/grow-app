import { useCallback, useState } from 'react';
import {
  Image, ImageBackground, Pressable, RefreshControl, ScrollView, Text, View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { COLORS } from '../../../../constants/colors';
import { s } from '../../../../constants/layout';
import { TRAINING_V2_MY_TRAINING_ASSETS } from '../../../../constants/toolAssets';
import { requireCurrentUserId } from '../../../../services/authUser';
import { TrainingV2StateView } from '../components/TrainingV2StateView';
import { useTrainingV2PlanDetail } from '../hooks/useTrainingV2PlanDetail';
import { useTrainingV2Plans } from '../hooks/useTrainingV2Plans';
import { estimateTrainingV2UnitDurationMinutes, findActiveTrainingV2Plan } from '../models/trainingV2ViewModel';
import { findTrainingV2SessionDraftForPlan } from '../services/trainingV2SessionDraftStorage';
import { styles } from '../styles/trainingV2Styles';

// Which unit "Mein Training" offers to start/resume: a resumable local draft (any strength
// unit of this plan with in-progress AsyncStorage state) always wins over the server's own
// cycle suggestion, since resuming unsaved work must never be shadowed by "start the next
// one instead". The suggestion itself is never recomputed here — the plan-detail read already
// resolves it server-side (the cycle tracker, or its own deterministic first-strength-unit
// fallback — see planSummarySelect in trainingPlanRepository.ts) to a unit that is guaranteed
// to be of type 'strength' whenever this revision has one at all, so trusting plan.nextUnit
// directly is exactly as reliable as re-deriving "first strength unit" here would be.
function resolveTargetUnit(plan, resumableUnitId) {
  const strengthUnits = plan.units.filter((unit) => unit.unitType === 'strength');
  if (strengthUnits.length === 0) return { unit: null, resuming: false };
  if (resumableUnitId) {
    const resumable = strengthUnits.find((unit) => unit.id === resumableUnitId);
    if (resumable) return { unit: resumable, resuming: true };
  }
  return { unit: plan.units.find((unit) => unit.id === plan.nextUnit.id), resuming: false };
}

function MyTrainingHeader() {
  return (
    <View style={styles.mtHeader}>
      <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.mtBackRow}>
        <Ionicons name="chevron-back" size={s(18)} color={COLORS.softGold} />
        <Text style={styles.mtBackText}>Zurück</Text>
      </Pressable>
      <Text style={styles.mtTitle}>Mein Training</Text>
      <Text style={styles.mtSubtitle}>Dein Training. Dein Fortschritt.</Text>
    </View>
  );
}

function SectionHeader({ icon, title, subtitle }) {
  return (
    <View style={styles.mtSectionHeaderRow}>
      <Ionicons name={icon} size={s(15)} color={COLORS.softGold} />
      <View style={styles.mtSectionHeaderTextWrap}>
        <Text style={styles.mtSectionHeaderTitle}>{title}</Text>
        <Text style={styles.mtSectionHeaderSubtitle}>{subtitle}</Text>
      </View>
    </View>
  );
}

export default function TrainingV2MyTrainingScreen() {
  const { plans, initialLoading, error, retry } = useTrainingV2Plans();
  const activePlan = findActiveTrainingV2Plan(plans);
  const {
    plan, loading: planLoading, error: planError, retry: retryPlan, refreshing, refresh,
  } = useTrainingV2PlanDetail(activePlan?.id ?? null);
  const [resumableUnitId, setResumableUnitId] = useState(null);

  useFocusEffect(useCallback(() => {
    let cancelled = false;
    if (!activePlan) {
      setResumableUnitId(null);
      return undefined;
    }
    (async () => {
      try {
        const ownerId = await requireCurrentUserId();
        const resumable = await findTrainingV2SessionDraftForPlan(ownerId, activePlan.id);
        if (!cancelled) setResumableUnitId(resumable?.unitId ?? null);
      } catch {
        if (!cancelled) setResumableUnitId(null);
      }
    })();
    return () => { cancelled = true; };
  }, [activePlan]));

  if (initialLoading || (error && !activePlan)) {
    return <TrainingV2StateView loading={initialLoading} error={error} onRetry={retry} />;
  }

  if (!activePlan) {
    return (
      <ScrollView contentContainerStyle={styles.content} style={styles.screen}>
        <MyTrainingHeader />
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>Noch kein aktiver Trainingsplan</Text>
          <Text style={styles.emptyText}>
            Wähle oder erstelle einen Trainingsplan, um mit dem Training zu starten.
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push({ pathname: '/tools/training-v2-plans' })}
            style={[styles.actionButton, { marginTop: 16 }]}
          >
            <Text style={styles.actionButtonText}>Trainingspläne öffnen</Text>
          </Pressable>
        </View>
      </ScrollView>
    );
  }

  if (planLoading || planError) {
    return <TrainingV2StateView loading={planLoading} error={planError} onRetry={retryPlan} />;
  }
  if (!plan) return null;

  const { unit: targetUnit, resuming } = resolveTargetUnit(plan, resumableUnitId);

  const openSession = (unitId) => {
    router.push({ pathname: '/tools/training-v2-session-active', params: { planId: plan.id, unitId } });
  };

  const openPlanDetail = () => {
    router.push({ pathname: '/tools/training-v2-plan-detail', params: { planId: plan.id } });
  };

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={COLORS.softGold} />}
      style={styles.screen}
    >
      <MyTrainingHeader />

      {targetUnit ? (
        <View style={styles.mtHeroCard}>
          {/* training-v2-my-training-hero.webp already bakes in its own rounded gold frame
              and athlete artwork on its right half, so only the text/CTA is overlaid here,
              confined to the image's left (dark) half — no extra border or icon layer. */}
          <ImageBackground
            source={TRAINING_V2_MY_TRAINING_ASSETS.hero}
            style={styles.mtHeroImage}
            imageStyle={styles.mtHeroImageInner}
            resizeMode="cover"
          >
            <View style={styles.mtHeroTextWrap}>
              <Text style={styles.mtHeroLabel}>{resuming ? 'AKTUELLES TRAINING' : 'NÄCHSTES TRAINING'}</Text>
              <Text style={styles.mtHeroUnitName} numberOfLines={2}>{targetUnit.name}</Text>
              <View style={styles.mtHeroMetaRow}>
                <Ionicons name="barbell-outline" size={s(13)} color={COLORS.textMuted} />
                <Text style={styles.mtHeroMetaText}>{targetUnit.exercises.length} Übungen</Text>
                <View style={styles.mtHeroMetaDot} />
                <Ionicons name="time-outline" size={s(13)} color={COLORS.textMuted} />
                <Text style={styles.mtHeroMetaText}>ca. {estimateTrainingV2UnitDurationMinutes(targetUnit)} Min.</Text>
              </View>
              <Pressable accessibilityRole="button" onPress={() => openSession(targetUnit.id)} style={styles.mtHeroButton}>
                <Ionicons name="play" size={s(14)} color={COLORS.nearBlack} />
                <Text style={styles.mtHeroButtonText}>{resuming ? 'Training fortsetzen' : 'Training starten'}</Text>
              </Pressable>
            </View>
          </ImageBackground>
        </View>
      ) : (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>Dieser Plan enthält keine Krafteinheiten zum Protokollieren.</Text>
        </View>
      )}

      {plan.units.filter((unit) => unit.unitType === 'strength').length > 1 ? (
        <View style={styles.mtUnitPickerWrap}>
          <Text style={styles.mtUnitPickerLabel}>Andere Einheit wählen</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.mtUnitPickerRow}>
            {plan.units.filter((unit) => unit.unitType === 'strength').map((unit) => (
              <Pressable
                key={unit.id}
                accessibilityRole="button"
                onPress={() => openSession(unit.id)}
                style={[styles.mtUnitChip, targetUnit?.id === unit.id && styles.mtUnitChipActive]}
              >
                <Text style={[styles.mtUnitChipText, targetUnit?.id === unit.id && styles.mtUnitChipTextActive]}>
                  {unit.name}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      ) : null}

      <SectionHeader icon="clipboard-outline" title="MEIN TRAININGSPLAN" subtitle="Dein aktueller Plan im Überblick." />
      <Pressable accessibilityRole="button" onPress={openPlanDetail} style={styles.mtPlanCard}>
        <Image source={TRAINING_V2_MY_TRAINING_ASSETS.planCalendar} style={styles.mtPlanCardIcon} />
        <View style={styles.mtPlanCardBody}>
          <Text style={styles.mtPlanCardName} numberOfLines={1}>{plan.name}</Text>
          <Text style={styles.mtPlanCardMeta}>
            {plan.weeklyGoal !== null ? `${plan.weeklyGoal} Trainingstage pro Woche` : 'Kein Wochenziel festgelegt'}
          </Text>
          {/* The plan's own unit order — flexible, cycle-based (see training_plan_cycle_states_v2
              / plan.nextUnit), never fixed weekdays, so each unit is shown as a named pill in
              its real order rather than mapped onto Mon–Sun dots. */}
          <View style={styles.mtPlanCycleRow}>
            {plan.units.map((unit) => (
              <View
                key={unit.id}
                style={[styles.mtPlanCyclePill, plan.nextUnit?.id === unit.id && styles.mtPlanCyclePillActive]}
              >
                <Text
                  numberOfLines={1}
                  style={[styles.mtPlanCyclePillText, plan.nextUnit?.id === unit.id && styles.mtPlanCyclePillTextActive]}
                >
                  {unit.name}
                </Text>
              </View>
            ))}
          </View>
        </View>
        <Ionicons name="chevron-forward" size={s(16)} color={COLORS.softGold} />
      </Pressable>

      <SectionHeader icon="time-outline" title="LETZTE TRAININGS" subtitle="Deine letzten Einheiten." />
      {/* No read path exists yet for past sessions (trainingSessionRepository.ts only ever
          exposes create()/loadSession-by-id, never a list) — an honest empty state, never demo
          rows, until that read contract exists. */}
      <View style={styles.mtEmptyHistoryCard}>
        <Ionicons name="file-tray-outline" size={s(22)} color={COLORS.textDim} />
        <Text style={styles.mtEmptyHistoryTitle}>Noch keine protokollierten Trainings</Text>
        <Text style={styles.mtEmptyHistoryText}>Deine abgeschlossenen Einheiten erscheinen hier.</Text>
      </View>

      <View style={styles.mtLowerRow}>
        <View style={styles.mtLowerCard}>
          <View style={styles.mtLowerCardHeaderRow}>
            <Image source={TRAINING_V2_MY_TRAINING_ASSETS.recordsTrophy} style={styles.mtLowerCardIcon} />
            <Text style={styles.mtLowerCardTitle}>PERSÖNLICHE REKORDE</Text>
          </View>
          <Text style={styles.mtLowerCardSubtitle}>Deine neuen Bestleistungen.</Text>
          <Text style={styles.mtLowerCardEmptyText}>Noch keine Rekorde.</Text>
        </View>
        <View style={styles.mtLowerCard}>
          <View style={styles.mtLowerCardHeaderRow}>
            <Image source={TRAINING_V2_MY_TRAINING_ASSETS.progress} style={styles.mtLowerCardIcon} />
            <Text style={styles.mtLowerCardTitle}>FORTSCHRITT</Text>
          </View>
          <Text style={styles.mtLowerCardSubtitle}>Deine Entwicklung.</Text>
          <Text style={styles.mtLowerCardEmptyText}>
            {plan.weeklyGoal !== null
              ? 'Sobald du dein Wochenziel trackst, siehst du hier deinen Fortschritt.'
              : 'Lege ein Wochenziel fest, um hier deinen Fortschritt zu sehen.'}
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}
