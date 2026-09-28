import { useCallback, useRef, useState } from 'react';
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

type PickedFile = { id: string; filename: string; uri: string; mimeType: string };

/**
 * Uploads a batch of locally-picked videos one at a time (sequential, to keep
 * memory/bandwidth predictable on a phone) and turns each successful upload
 * into a lesson automatically, in the order they were selected.
 *
 * `start` deliberately takes the exact files to process as an argument
 * instead of reading them back from React state: state updates are
 * asynchronous, so a "start" that closed over `items` from the render where
 * it was created could still see the array from before the newest batch was
 * enqueued.
 */
export function useVideoUploadQueue(accountId: string, courseId: string) {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [running, setRunning] = useState(false);
  const runningRef = useRef(false);

  function patchItem(id: string, patch: Partial<QueueItem>) {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  const enqueueAndStart = useCallback(
    async (files: PickedFile[]) => {
      setItems((current) => [
        ...current,
        ...files.map((f) => ({ ...f, status: 'queued' as QueueItemStatus, progress: 0 })),
      ]);

      if (runningRef.current) return;
      runningRef.current = true;
      setRunning(true);

      let orderIndex = await nextOrderIndex(courseId);

      for (const file of files) {
        patchItem(file.id, { status: 'uploading', progress: 0 });
        try {
          const result = await videoProvider.upload({
            accountId,
            courseId,
            localUri: file.uri,
            filename: file.filename,
            mimeType: file.mimeType,
            onProgress: (fraction) => patchItem(file.id, { progress: fraction }),
          });

          patchItem(file.id, { status: 'creating_lesson', progress: 1 });

          await createLesson({
            accountId,
            courseId,
            title: file.filename.replace(/\.[^/.]+$/, ''),
            videoId: result.videoId,
            orderIndex: orderIndex++,
          });

          patchItem(file.id, { status: 'done' });
        } catch (err) {
          patchItem(file.id, {
            status: 'error',
            errorMessage: err instanceof Error ? err.message : 'Falha no envio.',
          });
        }
      }

      runningRef.current = false;
      setRunning(false);
    },
    [accountId, courseId]
  );

  const reset = useCallback(() => setItems([]), []);

  return { items, running, enqueueAndStart, reset };
}
