import { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  FlatList,
  ImageBackground,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { COLORS } from '../../../../constants/colors';
import { s, sv, sf } from '../../../../constants/layout';
import { useHabitCollections } from '../hooks/useHabitCollections';
import ToolStateCard from '../../../../components/ui/ToolStateCard';
import { useDelayedLoading } from '../../../../hooks/useDelayedLoading';
import { styles as habitStyles } from '../styles/habitStyles';
import { HABITS_PAGE_BG } from '../../../../constants/toolAssets';

export default function HabitCollectionsScreen() {
  const {
    collections,
    loading,
    loadError,
    actionError,
    setActionError,
    loadCollections,
  } = useHabitCollections();

  const showLoading = useDelayedLoading(loading);

  useFocusEffect(
    useCallback(() => {
      void loadCollections({ silent: true });
    }, [loadCollections])
  );

  const handleOpenCollection = useCallback((collection) => {
    router.push({
      pathname: '/tools/habits-collection-detail',
      params: { collectionId: collection.id },
    });
  }, []);

  const handleCreateCollection = useCallback(() => {
    router.push('/tools/habits-collection-create');
  }, []);

  const handleBack = useCallback(() => {
    router.back();
  }, []);

  return (
    <ImageBackground
      source={HABITS_PAGE_BG}
      style={habitStyles.screen}
      imageStyle={habitStyles.backgroundImage}
      resizeMode="cover"
    >
      <View style={habitStyles.pageOverlay} pointerEvents="none" />

      <View style={habitStyles.topBar}>
        <Pressable onPress={handleBack} style={habitStyles.backButton}>
          <Ionicons name="chevron-back" size={s(24)} color={COLORS.softGold} />
          <Text style={habitStyles.backText}>Gewohnheiten</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={habitStyles.content} showsVerticalScrollIndicator={false}>
        <View style={habitStyles.header}>
          <Text style={habitStyles.title}>SAMMLUNGEN</Text>
          <Text style={habitStyles.subtitle}>Verwalte deine Habit-Sammlungen</Text>
        </View>

        {actionError && (
          <View style={habitStyles.errorBanner}>
            <Ionicons name="alert-circle-outline" size={s(16)} color={habitStyles.errorIcon.color} />
            <Text style={habitStyles.errorBannerText}>{actionError}</Text>
            <Pressable onPress={() => setActionError(null)} hitSlop={s(8)}>
              <Ionicons name="close" size={s(16)} color={COLORS.textDim} />
            </Pressable>
          </View>
        )}

        {loadError && (
          <View style={habitStyles.errorCard}>
            <Ionicons name="alert-circle-outline" size={s(20)} color={habitStyles.errorIcon.color} />
            <Text style={habitStyles.errorText}>{loadError}</Text>
            <Pressable onPress={loadCollections} style={habitStyles.retryBtn}>
              <Text style={habitStyles.retryText}>Erneut versuchen</Text>
            </Pressable>
          </View>
        )}

        {showLoading ? (
          <ToolStateCard
            loading
            title="Sammlungen werden geladen"
            subtitle="Deine Habit-Sammlungen werden vorbereitet."
          />
        ) : collections.length === 0 ? (
          <ToolStateCard
            icon="albums-outline"
            title="Noch keine Sammlungen."
            subtitle="Erstelle deine erste Sammlung und organisiere deine Gewohnheiten."
          />
        ) : (
          <FlatList
            scrollEnabled={false}
            data={collections}
            keyExtractor={c => c.id}
            renderItem={({ item: collection }) => (
              <Pressable
                style={collectionStyles.card}
                onPress={() => handleOpenCollection(collection)}
              >
                <View style={collectionStyles.content}>
                  <View style={collectionStyles.left}>
                    <Text style={collectionStyles.name} numberOfLines={1}>
                      {collection.name}
                    </Text>
                    <Text style={collectionStyles.meta}>
                      {collection.members?.length || 0} Gewohnheit{(collection.members?.length || 0) !== 1 ? 'en' : ''}
                    </Text>
                  </View>
                  <View style={collectionStyles.right}>
                    <Ionicons name="chevron-forward" size={s(20)} color={COLORS.textDim} />
                  </View>
                </View>
              </Pressable>
            )}
          />
        )}

        <Pressable style={habitStyles.addButton} onPress={handleCreateCollection}>
          <Ionicons name="add-circle-outline" size={s(22)} color={COLORS.gold} />
          <Text style={habitStyles.addText}>Neue Sammlung erstellen</Text>
        </Pressable>
      </ScrollView>
    </ImageBackground>
  );
}

const collectionStyles = {
  card: {
    marginBottom: sv(10),
    paddingHorizontal: s(14),
    paddingVertical: sv(12),
    backgroundColor: 'rgba(10,10,12,0.72)',
    borderRadius: s(14),
    borderWidth: 1,
    borderColor: COLORS.goldBorder,
    minHeight: sv(70),
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  left: {
    flex: 1,
  },
  name: {
    fontSize: sf(15),
    fontWeight: '800',
    color: COLORS.white,
    marginBottom: sv(4),
  },
  meta: {
    fontSize: sf(12),
    color: COLORS.textDim,
  },
  right: {
    marginLeft: s(12),
    justifyContent: 'center',
    alignItems: 'center',
  },
};
