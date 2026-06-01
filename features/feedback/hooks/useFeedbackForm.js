import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

import { sendFeedback } from '../services/feedbackService';
import { supabase } from '../../../services/supabaseClient';

const DEFAULT_TYPE = 'Idee / Vorschlag';
const DEFAULT_IMPORTANCE = 4;
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;

export function useFeedbackForm() {
  const isMountedRef = useRef(true);
  const isPickingImageRef = useRef(false);
  const isSendingRef = useRef(false);

  const [selectedType, setSelectedType] = useState(DEFAULT_TYPE);
  const [selectedImportance, setSelectedImportance] = useState(DEFAULT_IMPORTANCE);
  const [text, setText] = useState('');
  const [selectedImage, setSelectedImage] = useState(null);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState(null);
  const [sendSuccess, setSendSuccess] = useState(false);
  const [pointsAwarded, setPointsAwarded] = useState(false);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const clearStatus = useCallback(() => {
    if (!isMountedRef.current) return;

    setSendError(null);
    setSendSuccess(false);
    setPointsAwarded(false);
  }, []);

  const resetForm = useCallback(() => {
    if (!isMountedRef.current) return;

    setText('');
    setSelectedImage(null);
    setSelectedType(DEFAULT_TYPE);
    setSelectedImportance(DEFAULT_IMPORTANCE);
  }, []);

  const handlePickImage = useCallback(async () => {
    if (isPickingImageRef.current) return;

    isPickingImageRef.current = true;

    try {
      const permissionResult =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!isMountedRef.current) return;

      if (!permissionResult.granted) {
        Alert.alert(
          'Berechtigung nötig',
          'Bitte erlaube den Zugriff auf deine Fotos.'
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.7,
        base64: true,
      });

      if (!isMountedRef.current || result.canceled) return;

      const asset = result.assets?.[0];

      if (!asset?.uri || !asset?.base64) {
        Alert.alert('Fehler', 'Bild konnte nicht vorbereitet werden.');
        return;
      }

      if (asset.fileSize && asset.fileSize > MAX_IMAGE_SIZE_BYTES) {
        Alert.alert('Bild zu groß', 'Bitte wähle ein Bild bis maximal 5 MB aus.');
        return;
      }

      setSelectedImage({
        uri: asset.uri,
        base64: asset.base64,
        mimeType: asset.mimeType || 'image/jpeg',
        fileName: asset.fileName || `feedback-${Date.now()}.jpg`,
      });

      clearStatus();
    } catch (error) {
      console.log('Fehler beim Auswählen des Feedback-Bildes:', error);

      if (isMountedRef.current) {
        Alert.alert('Fehler', 'Bild konnte nicht ausgewählt werden.');
      }
    } finally {
      isPickingImageRef.current = false;
    }
  }, [clearStatus]);

  const handleRemoveImage = useCallback(() => {
    setSelectedImage(null);
    clearStatus();
  }, [clearStatus]);

  const handleSend = useCallback(async () => {
    if (isSendingRef.current) return;

    if (!text.trim()) {
      Alert.alert('Hinweis', 'Bitte schreibe zuerst dein Feedback.');
      return;
    }

    isSendingRef.current = true;

    try {
      setSending(true);
      clearStatus();

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        throw userError;
      }

      if (!user) {
        throw new Error('Kein User eingeloggt');
      }

      const result = await sendFeedback({
        userId: user.id,
        selectedType,
        selectedImportance,
        text,
        selectedImage,
      });

      if (!isMountedRef.current) return;

      resetForm();
      setPointsAwarded(Boolean(result?.pointsAwarded));
      setSendSuccess(true);
    } catch (error) {
      console.log('Fehler beim Senden von Feedback:', error);

      if (isMountedRef.current) {
        setSendError('Feedback konnte nicht gesendet werden. Bitte versuche es erneut.');
      }
    } finally {
      isSendingRef.current = false;

      if (isMountedRef.current) {
        setSending(false);
      }
    }
  }, [clearStatus, resetForm, selectedImage, selectedImportance, selectedType, text]);

  return {
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
  };
}
