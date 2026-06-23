import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Asset } from 'expo-asset';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import ScreenContainer from '../../../components/ui/ScreenContainer';
import { COLORS } from '../../../constants/colors';
import { s, sv, sf } from '../../../constants/layout';

const MENTOR_PAGE_BG = require('../../../assets/tool-icons/backgrounds/mentor-page-bg.webp');
const GROW_LOADING_LOGO = require('../../../assets/images/grow-loading.png');

export default function KIMentorScreen() {
  const router = useRouter();
  const [imageAssetReady, setImageAssetReady] = useState(false);
  const [imageVisible, setImageVisible] = useState(false);

  useEffect(() => {
    let mounted = true;

    Asset.loadAsync([MENTOR_PAGE_BG])
      .catch(() => {
        // Local bundled assets normally load reliably. If preloading fails,
        // still render the image so the screen does not get stuck loading.
      })
      .finally(() => {
        if (mounted) {
          setImageAssetReady(true);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

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
        {imageAssetReady && (
          <Image
            source={MENTOR_PAGE_BG}
            style={[styles.mentorImage, !imageVisible && styles.hiddenImage]}
            resizeMode="contain"
            onLoadEnd={() => setImageVisible(true)}
          />
        )}

        {!imageVisible && (
          <View style={styles.loadingOverlay}>
            <Image
              source={GROW_LOADING_LOGO}
              style={styles.loadingLogo}
              resizeMode="contain"
            />
            <ActivityIndicator color={COLORS.softGold} size="small" />
            <Text style={styles.loadingText}>KI Mentor wird geladen...</Text>
          </View>
        )}

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

  hiddenImage: {
    opacity: 0,
  },

  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000000',
    paddingBottom: sv(62),
    zIndex: 5,
  },

  loadingLogo: {
    width: s(120),
    height: s(120),
    marginBottom: sv(18),
  },

  loadingText: {
    color: COLORS.textDim,
    fontSize: sf(13),
    fontWeight: '600',
    marginTop: sv(10),
    textAlign: 'center',
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
