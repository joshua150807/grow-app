import { logger } from '../../../../lib/logger';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, ScrollView, Pressable, Modal, ImageBackground } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { COLORS } from '../../../../constants/colors';
import { RECOMMENDATIONS_PAGE_BG } from '../../../../constants/toolAssets';
import { s } from '../../../../constants/layout';

import {
  RECOMMENDATIONS,
  RECOMMENDATION_TYPES,
} from '../data/recommendationsData';
import {
  SAVED_RECOMMENDATIONS_STORAGE_KEY,
  getRecommendationTypeConfig,
  toggleIdInList,
} from '../utils/recommendationUtils';
import { styles } from '../styles/recommendationsStyles';
import PressableScale from '../../../../components/ui/PressableScale';

export default function RecommendationsScreen() {
  const [activeType, setActiveType] = useState('book');
  const [selectedItem, setSelectedItem] = useState(null);
  const [savedIds, setSavedIds] = useState([]);
  const mountedRef = useRef(true);
  const persistRequestRef = useRef(0);

  const validRecommendationIds = useMemo(
    () => new Set(RECOMMENDATIONS.map((item) => item.id)),
    []
  );

  const normalizeSavedIds = useCallback(
    (ids) => {
      if (!Array.isArray(ids)) return [];

      return [...new Set(ids.filter((id) => validRecommendationIds.has(id)))];
    },
    [validRecommendationIds]
  );

  useEffect(() => {
    mountedRef.current = true;

    async function loadSavedRecommendations() {
      try {
        const raw = await AsyncStorage.getItem(SAVED_RECOMMENDATIONS_STORAGE_KEY);
        if (!mountedRef.current || !raw) return;

        const parsed = JSON.parse(raw);
        const nextIds = normalizeSavedIds(parsed);
        setSavedIds(nextIds);
      } catch (error) {
        logger.warn('Could not load saved recommendations', error);
      }
    }

    loadSavedRecommendations();

    return () => {
      mountedRef.current = false;
    };
  }, [normalizeSavedIds]);

  const visibleRecommendations = useMemo(() => {
    if (activeType === 'saved') {
      return RECOMMENDATIONS.filter((item) => savedIds.includes(item.id));
    }

    return RECOMMENDATIONS.filter((item) => item.type === activeType);
  }, [activeType, savedIds]);

  const activeTypeConfig =
    activeType === 'saved'
      ? { key: 'saved', label: 'Gemerkt', icon: 'bookmark-outline' }
      : getRecommendationTypeConfig(RECOMMENDATION_TYPES, activeType);
  const savedCount = savedIds.length;

  const persistSavedIds = useCallback(async (nextIds) => {
    const requestId = persistRequestRef.current + 1;
    persistRequestRef.current = requestId;
    const safeIds = normalizeSavedIds(nextIds);

    if (mountedRef.current) {
      setSavedIds(safeIds);
    }

    try {
      await AsyncStorage.setItem(
        SAVED_RECOMMENDATIONS_STORAGE_KEY,
        JSON.stringify(safeIds)
      );
    } catch (error) {
      if (requestId === persistRequestRef.current) {
        logger.warn('Could not save recommendations', error);
      }
    }
  }, [normalizeSavedIds]);

  const toggleSaved = useCallback((id) => {
    if (!validRecommendationIds.has(id)) return;

    const nextIds = toggleIdInList(savedIds, id);
    persistSavedIds(nextIds);
  }, [persistSavedIds, savedIds, validRecommendationIds]);

  const closeDetail = useCallback(() => {
    setSelectedItem(null);
  }, []);

  return (
    <View style={styles.screen}>
      <ImageBackground
        source={RECOMMENDATIONS_PAGE_BG}
        style={styles.background}
        imageStyle={styles.backgroundImage}
        resizeMode="cover"
      >
        <View style={styles.backgroundOverlay}>
      <View style={styles.topBar}>
        <PressableScale onPress={() => router.back()} style={styles.backButton} hitSlop={8}>
          <Ionicons name="chevron-back" size={s(24)} color={COLORS.softGold} />
          <Text style={styles.backText}>Tools</Text>
        </PressableScale>

      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <View style={styles.headerTextWrap}>
            <Text style={styles.kicker}>GROW EMPFEHLUNGEN</Text>
            <Text style={styles.title}>Empfehlungen</Text>
            <Text style={styles.subtitle}>
              Kuratierte Bücher, Podcasts und Produkte, die dich wirklich weiterbringen können.
            </Text>
          </View>

          <PressableScale
            onPress={() => setActiveType('saved')}
            style={styles.headerIconWrap}
            hitSlop={8}
            activeScale={0.94}
          >
            <Ionicons name="bookmark-outline" size={s(24)} color={COLORS.toolsGold ?? COLORS.gold} />
          </PressableScale>
        </View>

        <View style={styles.heroCard}>
          <View style={styles.heroGlow} />

          <View style={styles.heroTopRow}>
            <View>
              <Text style={styles.heroLabel}>Gespeichert</Text>
              <Text style={styles.heroValue}>{savedCount}</Text>
              <Text style={styles.heroSubtext}>Empfehlungen für später</Text>
            </View>

            <View style={styles.miniBadge}>
              <Ionicons name="shield-checkmark" size={s(15)} color={COLORS.toolsGold ?? COLORS.gold} />
              <Text style={styles.miniBadgeText}>Kuratierte Auswahl</Text>
            </View>
          </View>

          <Text style={styles.heroQuote}>Nicht mehr Content. Besserer Content.</Text>
        </View>

        <View style={styles.typeTabs}>
          {RECOMMENDATION_TYPES.map((type) => {
            const active = activeType === type.key;

            return (
              <Pressable
                key={type.key}
                onPress={() => setActiveType(type.key)}
                style={[styles.typeTab, active && styles.typeTabActive]}
              >
                <Ionicons
                  name={type.icon}
                  size={s(17)}
                  color={active ? COLORS.black : COLORS.toolsGold ?? COLORS.gold}
                />
                <Text style={[styles.typeTabText, active && styles.typeTabTextActive]}>
                  {type.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {activeType === 'saved' ? (  
          <PressableScale
            onPress={() => setActiveType('book')}
            style={styles.backToOverviewButton}
          >
            <Ionicons name="chevron-back" size={17} color={COLORS.gold} />
            <Text style={styles.backToOverviewText}>Zurück zur Übersicht</Text>
          </PressableScale>
        ) : null}

        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>{activeTypeConfig.label}</Text>
          <Text style={styles.sectionCount}>{visibleRecommendations.length}</Text>
        </View>

        {visibleRecommendations.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons
              name={activeType === 'saved' ? 'bookmark-outline' : 'compass-outline'}
              size={s(42)}
              color="rgba(255,241,210,0.38)"
            />
            <Text style={styles.emptyTitle}>
              {activeType === 'saved' ? 'Noch nichts gemerkt' : 'Keine Empfehlungen gefunden'}
            </Text>
            <Text style={styles.emptyText}>
              {activeType === 'saved'
                ? 'Merke dir Bücher, Podcasts oder Produkte, die du später ansehen möchtest.'
                : 'Für diese Kategorie gibt es aktuell noch keine Empfehlungen.'}
            </Text>
          </View>
        ) : (
          visibleRecommendations.map((item) => {
            const saved = savedIds.includes(item.id);
            const typeConfig = getRecommendationTypeConfig(RECOMMENDATION_TYPES, item.type);

            return (
              <Pressable
                key={item.id}
                onPress={() => setSelectedItem(item)}
                style={styles.recommendationCard}
              >
                <View style={styles.cardTopRow}>
                  <View style={styles.typeIconBox}>
                    <Ionicons
                      name={typeConfig.icon}
                      size={s(21)}
                      color={COLORS.toolsGold ?? COLORS.gold}
                    />
                  </View>

                  <PressableScale
                    onPress={() => toggleSaved(item.id)}
                    style={[styles.saveCircle, saved && styles.saveCircleActive]}
                    hitSlop={8}
                    activeScale={0.9}
                  >
                    <Ionicons
                      name={saved ? 'bookmark' : 'bookmark-outline'}
                      size={s(18)}
                      color={saved ? COLORS.black : COLORS.toolsGold ?? COLORS.gold}
                    />
                  </PressableScale>
                </View>

                <Text style={styles.cardCategory}>{item.category}</Text>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <Text style={styles.cardCreator}>{item.creator}</Text>
                <Text style={styles.cardTagline}>{item.tagline}</Text>

                <View style={styles.metaRow}>
                  <View style={styles.metaPill}>
                    <Text style={styles.metaPillText}>{item.level}</Text>
                  </View>
                  <View style={styles.metaPill}>
                    <Text style={styles.metaPillText}>{item.duration}</Text>
                  </View>
                </View>
              </Pressable>
            );
          })
        )}
      </ScrollView>

      <Modal visible={!!selectedItem} transparent animationType="fade" onRequestClose={closeDetail}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalKicker}>{selectedItem?.category}</Text>
              <Pressable onPress={closeDetail} hitSlop={8}>
                <Ionicons name="close" size={s(24)} color={COLORS.toolsText ?? COLORS.textPrimary} />
              </Pressable>
            </View>

            <Text style={styles.modalTitle}>{selectedItem?.title}</Text>
            <Text style={styles.modalCreator}>{selectedItem?.creator}</Text>

            <View style={styles.modalMetaRow}>
              <View style={styles.metaPill}>
                <Text style={styles.metaPillText}>{selectedItem?.level}</Text>
              </View>
              <View style={styles.metaPill}>
                <Text style={styles.metaPillText}>{selectedItem?.duration}</Text>
              </View>
            </View>

            <Text style={styles.modalSectionTitle}>Warum empfohlen?</Text>
            <Text style={styles.modalText}>{selectedItem?.why}</Text>

            <Text style={styles.modalSectionTitle}>Kurz gesagt</Text>
            <Text style={styles.modalText}>{selectedItem?.tagline}</Text>

            <PressableScale
              onPress={() => selectedItem && toggleSaved(selectedItem.id)}
              style={styles.fullWidthSaveButton}
            >
              <Ionicons
                name={selectedItem && savedIds.includes(selectedItem.id) ? 'bookmark' : 'bookmark-outline'}
                size={s(18)}
                color={COLORS.black}
              />
              <Text style={styles.fullWidthSaveButtonText}>
                {selectedItem && savedIds.includes(selectedItem.id)
                  ? 'Aus Gemerkt entfernen'
                  : 'Empfehlung merken'}
              </Text>
            </PressableScale>
          </View>
        </View>
      </Modal>
        </View>
      </ImageBackground>
    </View>
  );
}