import { useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  ImageBackground,
  ActivityIndicator,
} from 'react-native';
import { Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { COLORS } from '../../../../constants/colors';
import { LEITFRAGEN_PAGE_BG } from '../../../../constants/toolAssets';
import { s, sv } from '../../../../constants/layout';
import PressableScale from '../../../../components/ui/PressableScale';
import { useDelayedLoading } from '../../../../hooks/useDelayedLoading';
import { useLeitfragenAnswers } from '../hooks/useLeitfragenAnswers';
import { styles } from '../styles/leitfragenStyles';
import { LEITFRAGEN_PAGES } from '../utils/leitfragenUtils';

export default function LeitfragenOverviewScreen() {
  const {
    answersByKey,
    loading,
    loadError,
    actionError,
    setActionError,
    loadAnswers,
  } = useLeitfragenAnswers();

  const showLoading = useDelayedLoading(loading);

  const handleOpenQuestion = useCallback((page) => {
    if (!page) return;

    router.push({
      pathname: '/tools/leitfragen/[questionKey]',
      params: { questionKey: page.key },
    });
  }, []);

  return (
    <>
      <Stack.Screen
        options={{
          gestureEnabled: true,
          fullScreenGestureEnabled: false,
        }}
      />
      <View style={styles.screen}>
        <ImageBackground
          source={LEITFRAGEN_PAGE_BG}
          style={styles.background}
          imageStyle={styles.backgroundImage}
          resizeMode="cover"
        >
          <View style={styles.backgroundOverlay}>
            <View style={styles.topBar}>
              <PressableScale
                onPress={() => router.back()}
                style={styles.backButton}
              >
                <Ionicons name="chevron-back" size={s(24)} color={COLORS.softGold} />
                <Text style={styles.backText}>Tools</Text>
              </PressableScale>
            </View>

            <View style={styles.gestureArea}>
              <ScrollView
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
                directionalLockEnabled
                keyboardShouldPersistTaps="handled"
              >
                <View style={styles.header}>
                  <Text style={styles.title}>LEITFRAGEN</Text>
                  <Text style={styles.subtitle}>
                    Große Fragen für Klarheit, Richtung und dein zukünftiges Ich.
                  </Text>
                </View>

                {loadError && (
                  <View style={styles.errorCard}>
                    <Text style={styles.errorText}>{loadError}</Text>
                    <PressableScale onPress={loadAnswers} style={styles.retryBtn}>
                      <Text style={styles.retryText}>Erneut versuchen</Text>
                    </PressableScale>
                  </View>
                )}

                {actionError && (
                  <View style={styles.errorBanner}>
                    <Ionicons name="alert-circle-outline" size={s(16)} color={COLORS.errorLight} />
                    <Text style={styles.errorText}>{actionError}</Text>
                    <PressableScale onPress={() => setActionError(null)} hitSlop={s(8)} activeScale={0.94}>
                      <Ionicons name="close" size={s(16)} color={COLORS.textDim} />
                    </PressableScale>
                  </View>
                )}

                <View style={styles.leitfragenListCard}>
                  <Text style={styles.tocSectionLabel}>GRUNDLAGEN</Text>
                  {LEITFRAGEN_PAGES.map((page, index) => {
                    const hasAnswer = Boolean(answersByKey[page.key]?.answer);
                    const showFutureDivider = index === 5;

                    return (
                      <View key={page.key}>
                        {showFutureDivider ? (
                          <View style={styles.tocSectionBreak}>
                            <Text style={styles.tocSectionLabel}>ZIELSETZUNGS-FRAGEN</Text>
                            <Text style={styles.tocSectionIntro}>
                              Halte fest, wo du dich kurz-, mittel- und langfristig siehst.
                            </Text>
                          </View>
                        ) : null}

                        <PressableScale
                          style={styles.tocItem}
                          onPress={() => handleOpenQuestion(page)}
                          activeScale={0.98}
                        >
                          <View style={styles.tocItemIcon}>
                            <Text style={styles.tocItemNumber}>{String(index + 1).padStart(2, '0')}</Text>
                          </View>
                          <View style={styles.tocItemTextWrap}>
                            <Text style={styles.tocItemTitle}>{page.title}</Text>
                            <Text style={styles.tocItemSubtitle}>{hasAnswer ? 'ausgefüllt' : 'noch leer'}</Text>
                          </View>
                          <Ionicons name="chevron-forward" size={s(18)} color={COLORS.textDim} />
                        </PressableScale>
                      </View>
                    );
                  })}

                  {showLoading ? (
                    <View style={{ paddingVertical: sv(8) }}>
                      <ActivityIndicator color={COLORS.gold} />
                    </View>
                  ) : null}
                </View>
              </ScrollView>
            </View>
          </View>
        </ImageBackground>
      </View>
    </>
  );
}
