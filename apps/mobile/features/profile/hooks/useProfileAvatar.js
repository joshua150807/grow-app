import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';

import { supabase } from '../../../services/supabaseClient';
import {
  confirmMyAvatarUploadV1,
  createMyAvatarUploadV1,
  deleteMyAvatarV1,
  isProfileApiV1Enabled,
} from '../services/profiles';

const PROFILE_AVATAR_BUCKET = 'profile-avatars';
const MAX_AVATAR_BYTES = 5_242_880;
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

function inferMimeType(asset) {
  if (ALLOWED_MIME_TYPES.has(asset?.mimeType)) {
    return asset.mimeType;
  }

  const candidate = `${asset?.fileName ?? ''} ${asset?.uri ?? ''}`.toLowerCase();

  if (/\.jpe?g(?:$|[?#\s])/.test(candidate)) return 'image/jpeg';
  if (/\.png(?:$|[?#\s])/.test(candidate)) return 'image/png';
  if (/\.webp(?:$|[?#\s])/.test(candidate)) return 'image/webp';

  return null;
}

function getAvatarErrorMessage(error, phase) {
  switch (error?.code) {
    case 'UNAUTHORIZED':
    case 'PROFILE_API_SESSION_ERROR':
    case 'PROFILE_API_SESSION_MISSING':
      return 'Deine Sitzung ist nicht mehr gültig. Bitte melde dich erneut an.';
    case 'PROFILE_NOT_FOUND':
      return 'Dein Profil konnte nicht gefunden werden.';
    case 'PROFILE_API_NETWORK_ERROR':
      return 'Verbindung zum Server fehlgeschlagen. Bitte versuche es erneut.';
    default:
      if (phase === 'permission') return 'Der Upload konnte nicht vorbereitet werden.';
      if (phase === 'storage') return 'Das Bild konnte nicht hochgeladen werden.';
      if (phase === 'confirm') return 'Das hochgeladene Bild konnte nicht bestätigt werden.';
      return 'Dein Profilbild konnte nicht aktualisiert werden.';
  }
}

export function useProfileAvatar({ avatarUrl, reloadProfile }) {
  const enabled = isProfileApiV1Enabled();
  const operationInProgressRef = useRef(false);
  const pickerInProgressRef = useRef(false);
  const [isUpdatingAvatar, setIsUpdatingAvatar] = useState(false);
  const [isResettingAvatar, setIsResettingAvatar] = useState(false);
  const [hasConfirmedAvatarReset, setHasConfirmedAvatarReset] = useState(false);

  useEffect(() => {
    if (avatarUrl == null) {
      setHasConfirmedAvatarReset(false);
    }
  }, [avatarUrl]);

  const runImagePicker = useCallback(async (source) => {
    if (!enabled || pickerInProgressRef.current || operationInProgressRef.current) return;

    pickerInProgressRef.current = true;

    try {
      const permission = source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        Alert.alert(
          'Berechtigung nötig',
          source === 'camera'
            ? 'Bitte erlaube Grow den Zugriff auf deine Kamera.'
            : 'Bitte erlaube Grow den Zugriff auf deine Fotos.',
        );
        return;
      }

      const picker = source === 'camera'
        ? ImagePicker.launchCameraAsync
        : ImagePicker.launchImageLibraryAsync;
      const result = await picker({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        shape: 'oval',
        quality: 0.8,
        base64: true,
      });

      if (result.canceled) return;

      const asset = result.assets?.[0];
      const mimeType = inferMimeType(asset);

      if (!asset?.uri || !asset?.base64) {
        Alert.alert('Fehler', 'Das Bild konnte nicht für den Upload vorbereitet werden.');
        return;
      }

      if (!mimeType) {
        Alert.alert('Dateityp nicht unterstützt', 'Bitte verwende ein JPG-, PNG- oder WebP-Bild.');
        return;
      }

      if (typeof asset.fileSize === 'number' && asset.fileSize > MAX_AVATAR_BYTES) {
        Alert.alert('Bild zu groß', 'Bitte wähle ein Bild bis maximal 5 MB aus.');
        return;
      }

      operationInProgressRef.current = true;
      setIsUpdatingAvatar(true);
      let phase = 'permission';

      try {
        const upload = await createMyAvatarUploadV1(mimeType);
        phase = 'storage';
        const body = decode(asset.base64);
        const { error: uploadError } = await supabase.storage
          .from(PROFILE_AVATAR_BUCKET)
          .uploadToSignedUrl(upload.path, upload.token, body, {
            contentType: mimeType,
          });

        if (uploadError) {
          throw uploadError;
        }

        phase = 'confirm';
        await confirmMyAvatarUploadV1(upload.path);
        await reloadProfile?.();
      } catch (error) {
        Alert.alert('Profilbild nicht aktualisiert', getAvatarErrorMessage(error, phase));
      } finally {
        operationInProgressRef.current = false;
        setIsUpdatingAvatar(false);
      }
    } catch {
      Alert.alert('Bild konnte nicht geöffnet werden', 'Bitte versuche es erneut.');
    } finally {
      pickerInProgressRef.current = false;
    }
  }, [enabled, reloadProfile]);

  const resetAvatar = useCallback(async () => {
    if (!enabled || !avatarUrl || operationInProgressRef.current) return;

    operationInProgressRef.current = true;
    setIsUpdatingAvatar(true);
    setIsResettingAvatar(true);

    try {
      const profile = await deleteMyAvatarV1();

      if (profile.avatarUrl !== null) {
        throw new Error('Avatar reset response is invalid.');
      }

      setHasConfirmedAvatarReset(true);
      await reloadProfile?.().catch(() => null);
    } catch (error) {
      setHasConfirmedAvatarReset(false);
      Alert.alert('Profilbild nicht zurückgesetzt', getAvatarErrorMessage(error, 'reset'));
    } finally {
      operationInProgressRef.current = false;
      setIsUpdatingAvatar(false);
      setIsResettingAvatar(false);
    }
  }, [avatarUrl, enabled, reloadProfile]);

  const showAvatarActions = useCallback(() => {
    if (!enabled || pickerInProgressRef.current || operationInProgressRef.current) return;

    const buttons = [
      { text: 'Foto aufnehmen', onPress: () => runImagePicker('camera') },
      { text: 'Aus Galerie auswählen', onPress: () => runImagePicker('library') },
    ];

    if (avatarUrl) {
      buttons.push({
        text: 'Auf Standardavatar zurücksetzen',
        style: 'destructive',
        onPress: resetAvatar,
      });
    }

    buttons.push({ text: 'Abbrechen', style: 'cancel' });

    Alert.alert('Profilbild ändern', undefined, buttons);
  }, [avatarUrl, enabled, resetAvatar, runImagePicker]);

  return {
    isAvatarEditingEnabled: enabled,
    hasConfirmedAvatarReset,
    isResettingAvatar,
    isUpdatingAvatar,
    showAvatarActions,
  };
}
