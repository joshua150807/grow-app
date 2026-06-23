import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { useCallback } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { COLORS } from '../../../../constants/colors';
import { s } from '../../../../constants/layout';
import { styles } from '../styles/trainingStyles';

const softPress = (baseStyle) => ({ pressed }) => [
  baseStyle,
  pressed && { opacity: 0.92, transform: [{ scale: 0.985 }] },
];
import { useLatestTrainingSessions } from '../hooks/useLatestTrainingSessions';
import { formatTrainingSessionDate } from '../utils/trainingDateUtils';
import { useDelayedLoading } from '../../../../hooks/useDelayedLoading';

const MUSCLE_GROUPS = [
  { id: 'chest', label: 'Brust', icon: 'body-outline' },
  { id: 'back', label: 'Rücken', icon: 'accessibility-outline' },
  { id: 'legs', label: 'Beine', icon: 'walk-outline' },
  { id: 'shoulders', label: 'Schulter', icon: 'fitness-outline' },
  { id: 'biceps', label: 'Bizeps', icon: 'barbell-outline' },
  { id: 'triceps', label: 'Trizeps', icon: 'barbell-outline' },
  { id: 'forearms', label: 'Unterarme', icon: 'hand-left-outline' },
  { id: 'core', label: 'Bauch', icon: 'ellipse-outline' },
];

export function OverviewView({ plan, onChangePlan }) {
  const {
    sessions,
    loadingSessions,
    sessionsError,
    loadSessions,
  } = useLatestTrainingSessions();
  const showSessionsLoading = useDelayedLoading(loadingSessions);

  useFocusEffect(
    useCallback(() => {
      loadSessions({ silent: true });
    }, [loadSessions])
  );

  const handleGoBack = useCallback(() => {
    router.back();
  }, []);

  const handleOpenTrainingSession = useCallback(() => {
    router.push('/tools/training-session');
  }, []);

  const handleOpenPlanEditor = useCallback(() => {
    router.push('/tools/training-plan-editor');
  }, []);

  const handleOpenTrainingSessions = useCallback(() => {
    router.push('/tools/training-sessions');
  }, []);

  const handleOpenMuscleGroup = useCallback((groupId) => {
    router.push({
      pathname: '/tools/training-muscle-group',
      params: { groupId },
    });
  }, []);

  return (
    <View style={styles.screen}>
      <View style={styles.topBar}>
        <Pressable
          onPress={handleGoBack}
          style={softPress(styles.backButton)}
          hitSlop={8}
        >
          <Ionicons name="chevron-back" size={s(24)} color={COLORS.softGold} />
          <Text style={styles.backText}>Tools</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Trainingsplan</Text>
        </View>

        <Pressable
          style={softPress(styles.startTrainingBanner)}
          onPress={handleOpenTrainingSession}
          hitSlop={8}
          android_ripple={{ color: 'rgba(212,175,55,0.12)' }}
        >
          <View style={styles.startTrainingIconWrap}>
            <Ionicons name="play-outline" size={s(26)} color={COLORS.softGold} />
          </View>

          <View style={styles.startTrainingContent}>
            <Text style={styles.startTrainingTitle}>Training starten</Text>
            <Text style={styles.startTrainingSubtitle}>
              Wähle deinen Trainingstag und beginne deine Einheit
            </Text>
          </View>

          <Ionicons name="chevron-forward" size={s(24)} color={COLORS.softGold} />
        </Pressable>

        <Pressable
          style={softPress(styles.trainingMainBanner)}
          onPress={handleOpenPlanEditor}
          hitSlop={8}
          android_ripple={{ color: 'rgba(212,175,55,0.12)' }}
        >
          <View>
            <Text style={styles.trainingMainBannerTitle}>
              Mein Trainingsplan ansehen und bearbeiten
            </Text>

            <Text style={styles.trainingMainBannerSubtitle}>
              {plan.days.length}{' '}
              {plan.days.length === 1 ? 'Trainingstag' : 'Trainingstage'} ansehen und bearbeiten
            </Text>
          </View>

          <Ionicons
            name="chevron-forward"
            size={s(24)}
            color={COLORS.softGold}
            style={{ transform: [{ translateX: -40 }] }}
          />
        </Pressable>

        <Pressable
          style={softPress(localStyles.changePlanBanner)}
          onPress={onChangePlan}
          hitSlop={8}
          android_ripple={{ color: 'rgba(212,175,55,0.12)' }}
        >
          <View style={localStyles.changePlanIconWrap}>
            <Ionicons name="swap-horizontal-outline" size={s(22)} color={COLORS.softGold} />
          </View>

          <View style={localStyles.changePlanContent}>
            <Text style={localStyles.changePlanTitle}>Plan wechseln</Text>
            <Text style={localStyles.changePlanSubtitle}>
              Wähle einen anderen Trainingsplan aus
            </Text>
          </View>

          <Ionicons name="chevron-forward" size={s(22)} color={COLORS.textDim} />
        </Pressable>

        <View style={styles.muscleGroupSection}>
          <Text style={styles.sectionLabel}>MUSKELGRUPPEN</Text>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.muscleGroupRow}
          >
            {MUSCLE_GROUPS.map((group) => (
              <Pressable
                key={group.id}
                style={softPress(styles.muscleGroupItem)}
                onPress={() => handleOpenMuscleGroup(group.id)}
                hitSlop={8}
              >
                <View style={styles.muscleGroupImagePlaceholder}>
                  <Ionicons name={group.icon} size={s(24)} color={COLORS.softGold} />
                </View>

                <Text style={styles.muscleGroupLabel}>{group.label}</Text>
              </Pressable>  
            ))}
          </ScrollView>
        </View>

        <Pressable
          style={softPress(styles.lastSessionsBanner)}
          onPress={handleOpenTrainingSessions}
          hitSlop={8}
          android_ripple={{ color: 'rgba(212,175,55,0.12)' }}
        >
          <View style={styles.lastSessionsHeader}>
            <View>
              <Text style={styles.lastSessionsTitle}>
                Letzte Trainingseinheiten
              </Text>

              <Text style={styles.lastSessionsSubtitle}>
                Deine neuesten 5 gespeicherten Trainings
              </Text>
            </View>

            {showSessionsLoading ? (
              <ActivityIndicator color={COLORS.softGold} />
            ) : (
              <Ionicons name="time-outline" size={s(24)} color={COLORS.textDim} />
            )}
          </View>

          {sessionsError ? (
            <Text style={styles.lastSessionsError}>{sessionsError}</Text>
          ) : null}

          {!loadingSessions && !sessionsError && sessions.length === 0 ? (
            <Text style={styles.lastSessionsEmpty}>
              Noch keine Trainingseinheit gespeichert.
            </Text>
          ) : null}

          {!loadingSessions && !sessionsError && sessions.length > 0 ? (
            <View style={styles.lastSessionsList}>
              {sessions.map((session) => (
                <View key={session.id} style={styles.lastSessionItem}>
                  <View style={styles.lastSessionDot} />

                  <View style={styles.lastSessionContent}>
                    <Text style={styles.lastSessionTitle}>
                      {session.dayName}
                    </Text>

                    <Text style={styles.lastSessionMeta}>
                      {formatTrainingSessionDate(session.performedAt)} ·{' '}
                      {session.exerciseCount}{' '}
                      {session.exerciseCount === 1 ? 'Übung' : 'Übungen'}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          ) : null}
        </Pressable>
      </ScrollView>
    </View>
  );
}

const localStyles = {
  changePlanBanner: {
    marginTop: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
    backgroundColor: 'rgba(10, 9, 17, 0.64)',
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },

  changePlanIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.035)',
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
  },

  changePlanContent: {
    flex: 1,
  },

  changePlanTitle: {
    color: COLORS.textPrimary,
    fontSize: 15,
    fontWeight: '900',
  },

  changePlanSubtitle: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 3,
  },
};