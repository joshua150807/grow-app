import React from 'react';
import {
  Image,
  ImageBackground,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { COLORS } from '../../../constants/colors';
import { s, sv, sf } from '../../../constants/layout';

const uploadFieldImage = require('../../../assets/feedback/feedback-upload-field.webp');

export default function FeedbackImageUploadCard({
  selectedImage,
  onPickImage,
  onRemoveImage,
}) {
  return (
    <View style={styles.wrap}>
      <TouchableOpacity
        activeOpacity={0.86}
        onPress={onPickImage}
        style={styles.uploadPressable}
      >
        <ImageBackground
          source={uploadFieldImage}
          style={styles.uploadBackground}
          imageStyle={styles.uploadImage}
          resizeMode="stretch"
        >
          <View style={styles.textLayer} pointerEvents="none">
            <Text style={styles.uploadTitle}>
              {selectedImage ? 'Bild ändern' : 'Bild hinzufügen'}
            </Text>
          </View>
        </ImageBackground>
      </TouchableOpacity>

      {selectedImage && (
        <View style={styles.previewWrap}>
          <Image
            source={{ uri: selectedImage.uri }}
            style={styles.previewImage}
            resizeMode="cover"
          />

          <View style={styles.previewFooter}>
            <Text style={styles.previewText}>Bild ausgewählt</Text>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={onRemoveImage}
              style={styles.removeButton}
            >
              <Text style={styles.removeText}>Entfernen</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: -s(2),
    marginBottom: sv(30),
  },
  uploadPressable: {
    width: '100%',
    height: sv(118),
    overflow: 'visible',
  },
  uploadBackground: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: sv(16),
    paddingHorizontal: s(20),
    overflow: 'hidden',
  },
  uploadImage: {
    borderRadius: s(18),
  },
  textLayer: {
    alignItems: 'center',
    transform: [{ translateY: sv(-10) }],
  },
  uploadTitle: {
    color: COLORS.lightGold,
    fontSize: sf(13),
    lineHeight: sv(17),
    fontWeight: '700',
    textAlign: 'center',
    textShadowColor: 'rgba(212,175,55,0.55)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  uploadSubtext: {
    color: COLORS.textDim,
    fontSize: sf(11),
    lineHeight: sv(14),
    fontWeight: '500',
    textAlign: 'center',
    marginTop: sv(2),
  },
  previewWrap: {
    marginTop: sv(12),
    borderRadius: s(18),
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.035)',
  },
  previewImage: {
    width: '100%',
    height: sv(170),
  },
  previewFooter: {
    minHeight: sv(42),
    paddingHorizontal: s(14),
    paddingVertical: sv(10),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  previewText: {
    color: COLORS.textDim,
    fontSize: sf(12),
    fontWeight: '600',
  },
  removeButton: {
    paddingHorizontal: s(12),
    paddingVertical: sv(7),
    borderRadius: s(999),
    backgroundColor: 'rgba(212,175,55,0.12)',
  },
  removeText: {
    color: COLORS.lightGold,
    fontSize: sf(12),
    fontWeight: '700',
  },
});
