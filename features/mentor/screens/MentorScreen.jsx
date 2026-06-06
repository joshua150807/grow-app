import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import ScreenContainer from '../../../components/ui/ScreenContainer';
import { COLORS } from '../../../constants/colors';
import { s, sv, sf } from '../../../constants/layout';

const MENTOR_PAGE_BG = require('../../../assets/tool-icons/backgrounds/mentor-page-bg.webp');

export default function KIMentorScreen() {
  const router = useRouter();

  const handleBack = () => {
    if (router.canGoBack?.()) {
      router.back();
      return;
    }

    router.replace('/tools');
  };

  return (
    <ScreenContainer style={styles.container}>
      <View style={styles.imageWrap}>
        <Image
          source={MENTOR_PAGE_BG}
          style={styles.mentorImage}
          resizeMode="contain"
        />

        <Pressable onPress={handleBack} style={styles.backButton}>
          <Ionicons name="chevron-back" size={s(22)} color={COLORS.softGold} />
          <Text style={styles.backText}>Tools</Text>
        </Pressable>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
  },

  imageWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: sv(62),
    overflow: 'visible',
  },

  mentorImage: {
    width: '110%',
    height: '110%',
  },

  backButton: {
    position: 'absolute',
    top: sv(34),
    left: s(18),
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: sv(6),
    paddingRight: s(12),
  },

  backText: {
    color: COLORS.softGold,
    fontSize: sf(15),
    fontWeight: '500',
    marginLeft: s(2),
  },
});