import { logger } from '../../../lib/logger';
import React, { useEffect, useState } from 'react';
import {
  Text,
  StyleSheet,
  ScrollView,
  View,
  ActivityIndicator,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import FeedbackHero from '../components/FeedbackHero';
import FeedbackTypeCards from '../components/FeedbackTypeCards';
import FeedbackTextInputCard from '../components/FeedbackTextInputCard';
import FeedbackImportanceCircles from '../components/FeedbackImportanceCircles';
import FeedbackImageUploadCard from '../components/FeedbackImageUploadCard';
import FeedbackInfoCards from '../components/FeedbackInfoCards';
import FeedbackSendButton from '../components/FeedbackSendButton';
import { useFeedbackForm } from '../hooks/useFeedbackForm';
import { COLORS } from '../../../constants/colors';
import { preloadFeedbackImageAssets } from '../../../constants/toolAssets';
import { s, sv, sf } from '../../../constants/layout';

const GROW_LOGO_HEADER = require('../../../assets/images/grow_banner_lossless.webp');
 
export default function FeedbackScreen() {
  const [feedbackAssetsReady, setFeedbackAssetsReady] = useState(false);

  useEffect(() => {
    let mounted = true;

    preloadFeedbackImageAssets()
      .catch((err) => {
        logger.warn('Feedback image preloading failed', err);
      })
      .finally(() => {
        if (mounted) {
          setFeedbackAssetsReady(true);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  const {
    selectedType,
    setSelectedType,
    selectedImportance,
    setSelectedImportance,
    text,
    setText,
    selectedImage,
    sending,
    sendError,
    handlePickImage,
    handleRemoveImage,
    handleSend,
    clearStatus,
  } = useFeedbackForm();
 
  if (!feedbackAssetsReady) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={COLORS.gold} />
          <Text style={styles.loadingText}>Feedback wird geladen...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Image
          source={GROW_LOGO_HEADER}
          style={styles.logoImage}
          resizeMode="contain"
        />

        <FeedbackHero />
 
        <Text style={styles.sectionTitle}>WAS MÖCHTEST DU FEEDBACK GEBEN?</Text>
 
        <FeedbackTypeCards
          selectedType={selectedType}
          onSelect={(type) => {
            setSelectedType(type);
            clearStatus();
          }}
        />
 
        <Text style={styles.sectionTitle}>WIE KÖNNEN WIR GROW VERBESSERN?</Text>
 
        <FeedbackTextInputCard
          value={text}
          onChangeText={(value) => {
            setText(value);
            clearStatus();
          }}
        />
 
        <Text style={styles.sectionTitle}>WIE WICHTIG IST DIR DAS?</Text>
        <Text style={styles.smallDescription}>
          Deine Einschätzung hilft uns zu priorisieren.
        </Text>
 
        <FeedbackImportanceCircles
          selectedImportance={selectedImportance}
          onSelect={(value) => {
            setSelectedImportance(value);
            clearStatus();
          }}
        />
 
        <Text style={styles.sectionTitle}>SCREENSHOT HINZUFÜGEN (OPTIONAL)</Text>
        <Text style={styles.smallDescription}>
          Ein Bild sagt mehr als 1.000 Worte.
        </Text>
 
        <FeedbackImageUploadCard
          selectedImage={selectedImage}
          onPickImage={handlePickImage}
          onRemoveImage={handleRemoveImage}
        />

        <FeedbackInfoCards />
 
        <FeedbackSendButton
          sending={sending}
          onPress={handleSend}
        />
 
        {sendError && <Text style={styles.errorText}>{sendError}</Text>}
 
        <Text style={styles.footerText}>
          Danke, dass du Grow besser machst. 🙏
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
 
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: s(24),
  },
  loadingText: {
    color: COLORS.textDim,
    fontSize: sf(13),
    fontWeight: '600',
    marginTop: sv(12),
    textAlign: 'center',
  },
  content: {
    paddingHorizontal: s(20),
    paddingTop: 0,
    paddingBottom: 40,
  },
  logoImage: {
    alignSelf: 'center',
    width: s(185),
    height: sv(42),
    marginTop: sv(4),
  },
  sectionTitle: {
    color: COLORS.white,
    fontSize: sf(13),
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: sv(12),
    marginTop: sv(4),
  },
  smallDescription: {
    color: COLORS.textDim,
    fontSize: sf(12),
    marginBottom: sv(14),
  },
  footerText: {
    textAlign: 'center',
    color: COLORS.textSecondary,
    fontSize: sf(12),
  },
  errorText: {
    textAlign: 'center',
    color: COLORS.error,
    fontSize: sf(13),
    lineHeight: 18,
    marginBottom: sv(14),
  },
});
