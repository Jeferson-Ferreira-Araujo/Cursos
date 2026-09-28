import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Crypto from 'expo-crypto';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { Button, Card, ProgressBar, Screen, TopBar } from '@/components/ui';
import { colors, radius, spacing, typography } from '@/theme';
import { useAuth } from '@/domain/auth/AuthContext';
import { useVideoUploadQueue } from '@/domain/videos/useVideoUploadQueue';

export default function AddLessonsScreen() {
  const { courseId } = useLocalSearchParams<{ courseId: string }>();
  const { account } = useAuth();
  const { items, running, enqueueAndStart } = useVideoUploadQueue(account!.id, courseId);
  const [pickingError, setPickingError] = useState<string | null>(null);

  const doneCount = items.filter((i) => i.status === 'done').length;
  const allDone = items.length > 0 && items.every((i) => i.status === 'done' || i.status === 'error');

  async function handlePickVideos() {
    setPickingError(null);
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setPickingError('Permita o acesso aos vídeos para continuar.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['videos'],
      allowsMultipleSelection: true,
      quality: 1,
    });
    if (result.canceled || result.assets.length === 0) return;

    const files = result.assets.map((asset) => ({
      id: Crypto.randomUUID(),
      uri: asset.uri,
      filename: asset.fileName ?? `video-${Date.now()}.mp4`,
      mimeType: asset.mimeType ?? 'video/mp4',
    }));

    enqueueAndStart(files);
  }

  function handleFinish() {
    if (running) {
      Alert.alert('Aguarde', 'O envio ainda está em andamento.');
      return;
    }
    router.back();
  }

  return (
    <Screen>
      <TopBar title="Adicionar aulas" />
      <Text style={styles.hint}>Envie seus vídeos. Nós cuidamos do restante — cada vídeo vira uma aula automaticamente.</Text>

      {items.length === 0 ? (
        <Pressable style={styles.dropzone} onPress={handlePickVideos}>
          <Ionicons name="cloud-upload-outline" size={32} color={colors.primary} />
          <Text style={styles.dropzoneText}>Escolher vídeos do seu aparelho</Text>
        </Pressable>
      ) : (
        <>
          {!!pickingError && <Text style={styles.errorText}>{pickingError}</Text>}
          <View style={styles.queue}>
            {items.map((item) => (
              <Card key={item.id} style={styles.queueItem}>
                <View style={styles.queueItemHeader}>
                  <Text style={styles.queueItemName} numberOfLines={1}>
                    {item.filename}
                  </Text>
                  <StatusLabel status={item.status} />
                </View>
                {(item.status === 'uploading' || item.status === 'creating_lesson') && (
                  <ProgressBar progress={item.status === 'creating_lesson' ? 1 : item.progress} />
                )}
                {item.status === 'error' && <Text style={styles.errorText}>{item.errorMessage}</Text>}
              </Card>
            ))}
          </View>

          <Button label="Adicionar mais vídeos" variant="secondary" onPress={handlePickVideos} disabled={running} />
          <Button
            label={allDone ? 'Concluir' : `Enviando ${doneCount}/${items.length}...`}
            onPress={handleFinish}
            loading={running}
            disabled={!allDone && !running}
          />
        </>
      )}
    </Screen>
  );
}

function StatusLabel({ status }: { status: string }) {
  const map: Record<string, string> = {
    queued: 'Na fila...',
    uploading: 'Enviando...',
    creating_lesson: 'Preparando aula...',
    done: 'Pronto',
    error: 'Erro',
  };
  const colorMap: Record<string, string> = {
    queued: colors.textMuted,
    uploading: colors.warning,
    creating_lesson: colors.warning,
    done: colors.success,
    error: colors.danger,
  };
  return <Text style={[styles.statusLabel, { color: colorMap[status] }]}>{map[status] ?? status}</Text>;
}

const styles = StyleSheet.create({
  hint: { ...typography.caption },
  dropzone: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingVertical: spacing.xxl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
  },
  dropzoneText: { ...typography.bodyMedium, color: colors.primary },
  queue: { gap: spacing.sm },
  queueItem: { gap: spacing.xs },
  queueItemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm },
  queueItemName: { ...typography.body, flex: 1 },
  statusLabel: { fontSize: 12, fontWeight: '600' },
  errorText: { ...typography.small, color: colors.danger },
});
