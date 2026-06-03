import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
 
import InfoCard from '../components/InfoCard';
import FeedbackHero from '../components/FeedbackHero';
import FeedbackTypeCards from '../components/FeedbackTypeCards';
import FeedbackTextInputCard from '../components/FeedbackTextInputCard';
import FeedbackImportanceCircles from '../components/FeedbackImportanceCircles';
import ImportanceButton from '../components/ImportanceButton';
import { useFeedbackForm } from '../hooks/useFeedbackForm';
import { COLORS } from '../../../constants/colors';
import { s, sv, sf } from '../../../constants/layout';
 
export default function FeedbackScreen() {
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
    sendSuccess,
    pointsAwarded,
    handlePickImage,
    handleRemoveImage,
    handleSend,
    clearStatus,
  } = useFeedbackForm();
 
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
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
 
        <View style={styles.importanceLabels}>
          <Text style={styles.importanceLabel}>Nicht wichtig</Text>
          <Text style={styles.importanceLabel}>Sehr wichtig</Text>
        </View>
 
        <Text style={styles.sectionTitle}>SCREENSHOT HINZUFÜGEN (OPTIONAL)</Text>
        <Text style={styles.smallDescription}>
          Ein Bild sagt mehr als 1.000 Worte.
        </Text>
 
        <TouchableOpacity
          style={styles.uploadBox}
          onPress={handlePickImage}
          activeOpacity={0.85}
        >
          <Feather name="image" size={22} color={COLORS.gold} />
          <Text style={styles.uploadTitle}>
            {selectedImage ? 'Bild ändern' : 'Bild hinzufügen'}
          </Text>
          <Text style={styles.uploadSubtext}>PNG, JPG bis 5 MB</Text>
        </TouchableOpacity>
 
        {selectedImage && (
          <View style={styles.previewWrap}>
            <Image
              source={{ uri: selectedImage.uri }}
              style={styles.previewImage}
            />
 
            <TouchableOpacity
              onPress={handleRemoveImage}
              style={styles.removeImageButton}
            >
              <Text style={styles.removeImageText}>Bild entfernen</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.topCardsContainer}>
          <InfoCard
            icon={<Ionicons name="bulb-outline" size={22} color={COLORS.gold} />}
            title="Deine Meinung zählt"
            text="Jedes Feedback bringt uns weiter."
          />
          <InfoCard
            icon={<Ionicons name="trending-up-outline" size={22} color={COLORS.gold} />}
            title="Gemeinsam wachsen"
            text="Wir hören zu und setzen um."
          />
          <InfoCard
            icon={<Ionicons name="gift-outline" size={22} color={COLORS.gold} />}
            title="Belohnt werden"
            text="Gib Feedback & sammle Grow Points."
          />
        </View>
 
        <TouchableOpacity
          style={[styles.sendButton, sending && styles.sendButtonDisabled]}
          onPress={handleSend}
          disabled={sending}
        >
          {sending ? (
            <>
              <ActivityIndicator color={COLORS.black} />
              <Text style={styles.sendButtonText}>Wird gesendet...</Text>
            </>
          ) : (
            <>
              <Text style={styles.sendButtonText}>Feedback senden</Text>
              <Ionicons name="paper-plane-outline" size={18} color={COLORS.nearBlack} />
            </>
          )}
        </TouchableOpacity>
 
        {sendSuccess && (
          <Text style={styles.successText}>
            {pointsAwarded
              ? 'Dein Feedback wurde gespeichert. Du hast 5 Grow Points erhalten.'
              : 'Dein Feedback wurde gespeichert.'}
          </Text>
        )}
 
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
    backgroundColor: 'black',
  },
  content: {
    paddingHorizontal: s(20),
    paddingTop: 0,
    paddingBottom: 40,
  },
  topCardsContainer: {
    flexDirection: 'row',
    gap: s(10),
    marginBottom: 26,
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
  importanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: sv(10),
  },
  importanceLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 28,
  },
  importanceLabel: {
    color: COLORS.textDim,
    fontSize: sf(11),
  },
  uploadBox: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: COLORS.borderMid,
    borderRadius: s(16),
    paddingVertical: 24,
    alignItems: 'center',
    marginBottom: 30,
    backgroundColor: COLORS.darkCard3,
  },
  previewWrap: {
    marginTop: sv(12),
  },
  previewImage: {
    width: '100%',
    height: 180,
    borderRadius: s(14),
  },
  removeImageButton: {
    marginTop: sv(10),
    alignSelf: 'flex-start',
  },
  removeImageText: {
    color: COLORS.textSecondary,
    fontSize: sf(13),
  },
  uploadTitle: {
    color: COLORS.lightGold,
    fontSize: sf(14),
    fontWeight: '600',
    marginTop: sv(8),
  },
  uploadSubtext: {
    color: COLORS.textDim,
    fontSize: sf(11),
    marginTop: sv(4),
  },
  sendButton: {
    backgroundColor: COLORS.gold,
    borderRadius: s(16),
    paddingVertical: sv(16),
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: s(8),
    marginBottom: 18,
  },
  sendButtonText: {
    color: COLORS.nearBlack,
    fontSize: sf(16),
    fontWeight: '700',
  },
  footerText: {
    textAlign: 'center',
    color: COLORS.textSecondary,
    fontSize: sf(12),
  },
  sendButtonDisabled: {
    opacity: 0.7,
  },
  successText: {
    textAlign: 'center',
    color: COLORS.gold,
    fontSize: sf(13),
    lineHeight: 18,
    marginBottom: sv(14),
  },
  errorText: {
    textAlign: 'center',
    color: COLORS.error,
    fontSize: sf(13),
    lineHeight: 18,
    marginBottom: sv(14),
  },
});
