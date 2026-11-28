import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, Image, ImageBackground, Pressable, RefreshControl, ScrollView, Text, View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { COLORS } from '../../../../constants/colors';
import { s } from '../../../../constants/layout';
import { TRAINING_V2_MY_TRAINING_ASSETS } from '../../../../constants/toolAssets';
import { TrainingHistoryCard } from '../components/TrainingV2HistoryViews';
import { useTrainingV2RecentSessions } from '../hooks/useTrainingV2History';
import { TrainingV2StateView } from '../components/TrainingV2StateView';
import { useTrainingV2PlanDetail } from '../hooks/useTrainingV2PlanDetail';
import { useTrainingV2Plans } from '../hooks/useTrainingV2Plans';
import { estimateTrainingV2UnitDurationMinutes, findActiveTrainingV2Plan } from '../models/trainingV2ViewModel';
import { findTrainingV2SessionDraftForPlan, requireTrainingV2SessionOwner } from '../services/trainingV2SessionDraftStorage';
import { styles } from '../styles/trainingV2Styles';
import { useTrainingV2ContentStyle } from '../hooks/useTrainingV2ContentStyle';

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
  return { unit: strengthUnits.find((unit) => unit.id === plan.nextUnit?.id), resuming: false };
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

function RecentTrainingSection({ recent }) {
  return (
    <View style={styles.section}>
      <SectionHeader icon="time-outline" title="LETZTE TRAININGS" subtitle="Deine letzten Einheiten." />
      <TrainingV2StateView loading={recent.loading} error={recent.error} onRetry={recent.retry} />
      {recent.data?.map((session) => <TrainingHistoryCard key={session.id} session={session} />)}
      {recent.data?.length === 0 ? (
        <View style={styles.mtEmptyHistoryCard}>
          <Ionicons name="file-tray-outline" size={s(22)} color={COLORS.textDim} />
          <Text style={styles.mtEmptyHistoryTitle}>Noch keine abgeschlossenen Trainings</Text>
        </View>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Alle Trainings anzeigen"
        onPress={() => router.push({ pathname: '/tools/training-v2-history' })}
        style={styles.retryButton}
      >
        <Text style={styles.retryText}>Alle anzeigen</Text>
      </Pressable>
    </View>
  );
}

export default function TrainingV2MyTrainingScreen() {
  const contentStyle = useTrainingV2ContentStyle();
  const recent = useTrainingV2RecentSessions();
  const { plans, initialLoading, fetching: plansFetching, error, retry, refreshing: plansRefreshing, refresh: refreshPlans } = useTrainingV2Plans();
  const activePlan = findActiveTrainingV2Plan(plans);
  const {
    plan, loading: planLoading, fetching: planFetching, error: planError, retry: retryPlan, refreshing, refresh,
  } = useTrainingV2PlanDetail(activePlan?.id ?? null);
  const [resumableUnitId, setResumableUnitId] = useState(null);
  const [resumableDraft, setResumableDraft] = useState(null);
  const [resumeError, setResumeError] = useState(null);
  const [resumeRefresh, setResumeRefresh] = useState(0);
  const [selection, setSelection] = useState(null);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState(null);
  const startingRef = useRef(false);
  const focusedRef = useRef(false);
  const startGenerationRef = useRef(0);
  const currentSelectionRef = useRef(null);

  useFocusEffect(useCallback(() => {
    focusedRef.current = true;
    startingRef.current = false;
    setStarting(false);
    return () => { focusedRef.current = false; startGenerationRef.current += 1; };
  }, []));

  useFocusEffect(useCallback(() => {
    let cancelled = false;
    (async () => {
      try {
        const ownerId = await requireTrainingV2SessionOwner();
        const resumable = await findTrainingV2SessionDraftForPlan(ownerId);
        if (!cancelled) {
          setResumableDraft(resumable);
          setResumableUnitId(resumable && activePlan && resumable.planId === activePlan.id ? resumable.unitId : null);
          setResumeError(null);
        }
      } catch (nextError) {
        if (!cancelled) { setResumableUnitId(null); setResumableDraft(null); setResumeError(nextError); }
      }
    })();
    return () => { cancelled = true; };
  }, [activePlan, resumeRefresh]));

  const matchingPlan = activePlan && plan?.id === activePlan.id;
  const planStatus = (initialLoading && !activePlan) || (error && !activePlan)
    ? { loading: initialLoading, error, onRetry: retry }
    : activePlan && !matchingPlan && (planLoading || planError)
      ? { loading: planLoading, error: planError, onRetry: retryPlan }
      : null;
  const showPlan = activePlan && plan && plan.id === activePlan.id && !planStatus;
  const selectionScope = showPlan ? `${plan.id}:${plan.currentRevisionId ?? plan.revision?.id ?? plan.units.map(unit => unit.id).join(',')}` : null;
  const { unit: suggestedUnit } = showPlan ? resolveTargetUnit(plan, resumableUnitId) : {};
  const targetUnit = showPlan && selection?.scope === selectionScope
    ? plan.units.find(unit => unit.id === selection.unitId) ?? suggestedUnit : suggestedUnit;
  const resuming = Boolean(targetUnit && resumableDraft?.planId === plan?.id && resumableDraft.unitId === targetUnit.id);
  currentSelectionRef.current = { scope: selectionScope, planId: showPlan ? plan.id : null, unitId: targetUnit?.id };
  useEffect(() => { setSelection(null); setStartError(null); }, [selectionScope]);
  const showSeparateResume = resumableDraft && (!showPlan || resumableDraft.planId !== plan.id
    || !plan.units.some((unit) => unit.id === resumableDraft.unitId));

  const releaseStart = (generation = startGenerationRef.current) => {
    if (generation !== startGenerationRef.current) return;
    startingRef.current = false;
    if (focusedRef.current) setStarting(false);
  };
  const navigateSession = (planId, unitId) => {
    router.push({ pathname: '/tools/training-v2-session-active', params: { planId, unitId } });
  };
  const startDisabled = !showPlan || !targetUnit || targetUnit.unitType !== 'strength'
    || Boolean(starting || plansFetching || planFetching || plansRefreshing || refreshing || error || planError);
  const startSelectedUnit = async () => {
    if (startingRef.current || startDisabled || !focusedRef.current) return;
    startingRef.current = true;
    setStarting(true);
    setStartError(null);
    const chosen = { ...currentSelectionRef.current };
    const generation = startGenerationRef.current;
    const releaseChosen = () => releaseStart(generation);
    const stillCurrent = () => focusedRef.current && generation === startGenerationRef.current
      && currentSelectionRef.current.scope === chosen.scope && currentSelectionRef.current.unitId === chosen.unitId;
    const openChosen = () => {
      if (!stillCurrent()) { releaseChosen(); return; }
      try { navigateSession(chosen.planId, chosen.unitId); }
      catch (nextError) { setStartError(nextError); releaseChosen(); }
    };
    try {
      const owner = await requireTrainingV2SessionOwner();
      const saved = await findTrainingV2SessionDraftForPlan(owner);
      if (!stillCurrent()) { releaseChosen(); return; }
      if (saved && (saved.planId !== chosen.planId || saved.unitId !== chosen.unitId)) {
        let decided = false;
        Alert.alert('Gespeichertes Training vorhanden',
          'Du hast eine andere Einheit als Entwurf. Du kannst sie fortsetzen oder die ausgewählte Einheit starten. Der bisherige Entwurf bleibt dabei erhalten.', [
            { text: 'Abbrechen', style: 'cancel', onPress: () => { decided = true; releaseChosen(); } },
            { text: 'Gespeichertes Training fortsetzen', onPress: () => {
              decided = true;
              if (!stillCurrent()) { releaseChosen(); return; }
              try { navigateSession(saved.planId, saved.unitId); }
              catch (nextError) { setStartError(nextError); releaseChosen(); }
            } },
            { text: 'Ausgewählte Einheit starten', onPress: () => { decided = true; openChosen(); } },
          ], { cancelable: true, onDismiss: () => { if (!decided) releaseChosen(); } });
        return;
      }
      openChosen();
    } catch (nextError) {
      if (stillCurrent()) setStartError(nextError);
      releaseChosen();
    }
  };
  const resumeSavedDraft = () => {
    if (startingRef.current || !resumableDraft || !focusedRef.current) return;
    startingRef.current = true;
    setStarting(true);
    try { navigateSession(resumableDraft.planId, resumableDraft.unitId); }
    catch (nextError) { setStartError(nextError); releaseStart(); }
  };

  const openPlanDetail = () => {
    const params = plan.sourceTemplateId ? { templateId: plan.sourceTemplateId, planId: plan.id } : { planId: plan.id };
    router.push({ pathname: '/tools/training-v2-plan-detail', params });
  };

  return (
    <ScrollView
      contentContainerStyle={contentStyle}
      refreshControl={<RefreshControl refreshing={recent.refreshing || plansRefreshing || (Boolean(activePlan) && refreshing)} onRefresh={() => {
        void recent.refresh();
        void refreshPlans();
        setResumeRefresh((value) => value + 1);
        if (activePlan) void refresh();
      }} tintColor={COLORS.softGold} />}
      style={styles.screen}
    >
      <MyTrainingHeader />
      {startError ? <Text style={styles.formErrorText}>{startError.message ?? 'Das Training konnte nicht geöffnet werden.'}</Text> : null}
      {matchingPlan && (error || planError) ? <TrainingV2StateView error={error || planError} onRetry={() => { void retry(); void retryPlan(); }} /> : null}
      {resumeError ? <Text style={styles.formErrorText}>{resumeError.message}</Text> : null}
      {showSeparateResume ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>Gespeichertes Training</Text>
          <Text style={styles.emptyText}>{resumableDraft.session.planName} · {resumableDraft.session.unitName}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Gespeicherten Trainingsentwurf fortsetzen"
            disabled={starting}
            onPress={resumeSavedDraft}
            style={styles.actionButton}>
            <Text style={styles.actionButtonText}>Training fortsetzen</Text>
          </Pressable>
        </View>
      ) : null}
      {planStatus ? <TrainingV2StateView {...planStatus} /> : null}
      {!activePlan && !planStatus ? (
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
      ) : null}

      {showPlan ? <>

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
                <Text style={styles.mtHeroLabel}>{resuming ? 'AKTUELLES TRAINING' : targetUnit.id === plan.nextUnit?.id ? 'NÄCHSTES TRAINING' : 'AUSGEWÄHLTE EINHEIT'}</Text>
                <Text style={styles.mtHeroUnitName} numberOfLines={2}>{targetUnit.name}</Text>
                <View style={styles.mtHeroMetaRow}>
                  <Ionicons name={targetUnit.unitType === 'strength' ? 'barbell-outline' : 'calendar-outline'} size={s(13)} color={COLORS.textMuted} />
                  <Text style={styles.mtHeroMetaText}>{targetUnit.unitType === 'strength' ? `${targetUnit.exercises.length} Übungen` : targetUnit.unitTypeLabel}</Text>
                  {targetUnit.unitType === 'strength' ? <><View style={styles.mtHeroMetaDot} />
                  <Ionicons name="time-outline" size={s(13)} color={COLORS.textMuted} />
                  <Text style={styles.mtHeroMetaText}>ca. {estimateTrainingV2UnitDurationMinutes(targetUnit)} Min.</Text></> : null}
                </View>
                <Pressable accessibilityRole="button" accessibilityLabel={resuming ? 'Ausgewählte Einheit fortsetzen' : 'Ausgewählte Einheit starten'} accessibilityHint={targetUnit.name} disabled={startDisabled} onPress={startSelectedUnit} style={[styles.mtHeroButton, startDisabled && styles.actionButtonDisabled]}>
                  {starting ? <ActivityIndicator color={COLORS.nearBlack} /> : <Ionicons name="play" size={s(14)} color={COLORS.nearBlack} />}
                  <Text style={styles.mtHeroButtonText}>{resuming ? 'Training fortsetzen' : 'Training starten'}</Text>
                </Pressable>
              </View>
            </ImageBackground>
          </View>
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>{plan.units.some(unit => unit.unitType === 'strength') ? 'Wähle eine Trainingseinheit aus.' : 'Dieser Plan enthält keine Krafteinheiten zum Protokollieren.'}</Text>
          </View>
        )}

        {targetUnit && targetUnit.unitType !== 'strength' ? <Text style={styles.formHint}>Für diesen Einheitstyp ist noch keine Trainingsprotokollierung verfügbar.</Text> : null}
        {plan.units.length > 0 ? (
          <View style={styles.mtUnitPickerWrap}>
            <Text style={styles.mtUnitPickerLabel}>Trainingseinheit auswählen</Text>
            <View style={styles.mtUnitPickerRow}>
              {plan.units.map((unit) => (
                <Pressable
                  key={unit.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Einheit ${unit.name} auswählen`}
                  accessibilityState={{ selected: targetUnit?.id === unit.id, disabled: starting }}
                  disabled={starting}
                  onPress={() => {
                    if (startingRef.current) return;
                    setSelection({ scope: selectionScope, unitId: unit.id });
                    setStartError(null);
                  }}
                  style={[styles.mtUnitChip, targetUnit?.id === unit.id && styles.mtUnitChipActive]}
                >
                  <Text style={[styles.mtUnitChipText, targetUnit?.id === unit.id && styles.mtUnitChipTextActive]}>
                    {unit.name}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

        <SectionHeader icon="clipboard-outline" title="MEIN TRAININGSPLAN" subtitle="Dein aktueller Plan im Überblick." />
        <Pressable accessibilityRole="button" accessibilityLabel="Aktiven Trainingsplan ansehen" onPress={openPlanDetail} style={styles.mtPlanCard}>
          <Image source={TRAINING_V2_MY_TRAINING_ASSETS.planCalendar} style={styles.mtPlanCardIcon} />
          <View style={styles.mtPlanCardBody}>
            <Text style={styles.mtPlanCardName} numberOfLines={1}>{plan.name}</Text>
            <Text style={styles.mtPlanCardMeta}>
              {plan.weeklyGoal !== null ? `${plan.weeklyGoal} Trainingstage pro Woche` : 'Kein Wochenziel festgelegt'}
            </Text>
            {plan.units.some(unit => unit.id === plan.nextUnit?.id) ? <Text style={styles.mtPlanCardMeta}>
              Nächste Einheit im Zyklus: {plan.units.find(unit => unit.id === plan.nextUnit.id).name}
            </Text> : null}
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

      </> : null}

      <RecentTrainingSection recent={recent} />

      <View style={styles.mtLowerRow}>
        <Pressable accessibilityRole="button" accessibilityLabel="Persönliche Rekorde öffnen" onPress={() => router.push({ pathname: '/tools/training-v2-records' })} style={styles.mtLowerCard}>
          <View style={styles.mtLowerCardHeaderRow}>
            <Image source={TRAINING_V2_MY_TRAINING_ASSETS.recordsTrophy} style={styles.mtLowerCardIcon} />
            <Text style={styles.mtLowerCardTitle}>PERSÖNLICHE REKORDE</Text>
          </View>
          <Text style={styles.mtLowerCardSubtitle}>Deine Bestleistungen nach Übung.</Text>
          <Text style={styles.mtLowerCardEmptyText}>Rekorde ansehen →</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Trainingsfortschritt öffnen" onPress={() => router.push({ pathname: '/tools/training-v2-progress' })} style={styles.mtLowerCard}>
          <View style={styles.mtLowerCardHeaderRow}>
            <Image source={TRAINING_V2_MY_TRAINING_ASSETS.progress} style={styles.mtLowerCardIcon} />
            <Text style={styles.mtLowerCardTitle}>FORTSCHRITT</Text>
          </View>
          <Text style={styles.mtLowerCardSubtitle}>Häufigkeit, Dauer und Leistungsentwicklung.</Text>
          <Text style={styles.mtLowerCardEmptyText}>Fortschritt ansehen →</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}
