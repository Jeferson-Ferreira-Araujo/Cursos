import { useCallback, useState } from 'react';
import { videoProvider } from '@/domain/videos';
import { createLesson, nextOrderIndex } from '@/domain/lessons/api';

export type QueueItemStatus = 'queued' | 'uploading' | 'creating_lesson' | 'done' | 'error';

export type QueueItem = {
  id: string;
  filename: string;
  uri: string;
  mimeType: string;
  status: QueueItemStatus;
  progress: number;
  errorMessage?: string;
};

/**
 * Uploads a batch of locally-picked videos one at a time (sequential, to keep
 * memory/bandwidth predictable on a phone) and turns each successful upload
 * into a lesson automatically, in the order they were selected.
 */
export function useVideoUploadQueue(accountId: string, courseId: string) {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [running, setRunning] = useState(false);

  function patchItem(id: string, patch: Partial<QueueItem>) {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  const enqueue = useCallback((files: { id: string; filename: string; uri: string; mimeType: string }[]) => {
    setItems((current) => [
      ...current,
      ...files.map((f) => ({ ...f, status: 'queued' as QueueItemStatus, progress: 0 })),
    ]);
  }, []);

  const start = useCallback(async () => {
    if (running) return;
    setRunning(true);

    let orderIndex = await nextOrderIndex(courseId);

    // Snapshot queued ids up front so items added mid-run are picked up by the next call.
    const queued = items.filter((item) => item.status === 'queued');

    for (const item of queued) {
      patchItem(item.id, { status: 'uploading', progress: 0 });
      try {
        const result = await videoProvider.upload({
          accountId,
          courseId,
          localUri: item.uri,
          filename: item.filename,
          mimeType: item.mimeType,
          onProgress: (fraction) => patchItem(item.id, { progress: fraction }),
        });

        patchItem(item.id, { status: 'creating_lesson', progress: 1 });

        await createLesson({
          accountId,
          courseId,
          title: item.filename.replace(/\.[^/.]+$/, ''),
          videoId: result.videoId,
          orderIndex: orderIndex++,
        });

        patchItem(item.id, { status: 'done' });
      } catch (err) {
        patchItem(item.id, {
          status: 'error',
          errorMessage: err instanceof Error ? err.message : 'Falha no envio.',
        });
      }
    }

    setRunning(false);
  }, [accountId, courseId, running, items]);

  const reset = useCallback(() => setItems([]), []);

  return { items, running, enqueue, start, reset };
}
