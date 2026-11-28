import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { VideoView, useVideoPlayer } from 'expo-video';
import { Ionicons } from '@expo/vector-icons';

import { COLORS } from '../../../constants/colors';
import { s, sv, sf } from '../../../constants/layout';
import { resolveAdminVideoUrl } from '../services/adminVideoAnalytics';

// Fullscreen preview of a single video from the CEO dashboard. The player only exists
// while the modal is open, so the analytics list itself never loads any video.
export default function AdminVideoPlayerModal({ video, onClose }) {
  return (
    <Modal
      visible={Boolean(video)}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      {video ? <AdminVideoPlayerContent video={video} onClose={onClose} /> : null}
    </Modal>
  );
}

function AdminVideoPlayerContent({ video, onClose }) {
  const insets = useSafeAreaInsets();
  const [source, setSource] = useState(video.videoUrl ?? null);
  const [errorText, setErrorText] = useState(null);

  useEffect(() => {
    if (video.videoUrl) return undefined;

    let cancelled = false;
    resolveAdminVideoUrl(video.id)
      .then((url) => {
        if (cancelled) return;
        if (url) setSource(url);
        else setErrorText('Für dieses Video ist keine Datei hinterlegt.');
      })
      .catch(() => {
        if (!cancelled) setErrorText('Das Video konnte nicht geladen werden.');
      });

    return () => { cancelled = true; };
  }, [video.id, video.videoUrl]);

  return (
    <View style={[styles.screen, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.header}>
        <Text style={styles.title} numberOfLines={1}>{video.title}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Video schließen"
          onPress={onClose}
          hitSlop={s(10)}
          style={({ pressed }) => [styles.closeButton, pressed && styles.closeButtonPressed]}
        >
          <Ionicons name="close" size={s(22)} color={COLORS.softGold} />
        </Pressable>
      </View>

      <View style={styles.playerArea}>
        {errorText ? (
          <Text style={styles.errorText}>{errorText}</Text>
        ) : source ? (
          <AdminVideoView source={source} />
        ) : (
          <ActivityIndicator color={COLORS.gold} />
        )}
      </View>
    </View>
  );
}

function AdminVideoView({ source }) {
  const player = useVideoPlayer(source, (instance) => {
    instance.loop = false;
    instance.muted = false;
    instance.play();
  });

  return (
    <VideoView
      style={styles.video}
      player={player}
      contentFit="contain"
      nativeControls
    />
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.black,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(12),
    paddingHorizontal: s(16),
    paddingVertical: sv(10),
  },
  title: {
    flex: 1,
    color: COLORS.white,
    fontSize: sf(16),
    fontWeight: '800',
  },
  closeButton: {
    width: s(38),
    height: s(38),
    borderRadius: s(19),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  closeButtonPressed: {
    opacity: 0.7,
  },
  playerArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  video: {
    width: '100%',
    height: '100%',
  },
  errorText: {
    color: COLORS.textSecondary,
    fontSize: sf(14),
    textAlign: 'center',
    paddingHorizontal: s(24),
  },
});
