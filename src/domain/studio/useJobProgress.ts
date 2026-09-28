import { useEffect, useRef, useState } from 'react';
import type { ProcessingJob } from './types';

/**
 * Drives a progress bar for a running Studio job. Uses real
 * `{generated, total}` progress from the job row when a function reports it
 * (e.g. cover generation writes it as each image finishes) and otherwise
 * estimates progress from elapsed time against a rough ceiling -- good
 * enough to show the Creator something is actually moving, instead of a
 * single indefinite spinner for a call that can take up to a minute.
 */
export function useJobProgress(active: boolean, estimatedSeconds = 20) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [realProgress, setRealProgress] = useState<{ generated: number; total: number } | null>(null);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    if (!active) {
      startRef.current = null;
      setElapsedSeconds(0);
      setRealProgress(null);
      return;
    }
    startRef.current = Date.now();
    const interval = setInterval(() => {
      setElapsedSeconds((Date.now() - (startRef.current ?? Date.now())) / 1000);
    }, 300);
    return () => clearInterval(interval);
  }, [active]);

  function onProgress(job: ProcessingJob) {
    const output = job.output as { generated?: number; total?: number } | null;
    if (output?.generated != null && output?.total) {
      setRealProgress({ generated: output.generated, total: output.total });
    }
  }

  const progress = realProgress ? realProgress.generated / realProgress.total : Math.min(0.92, elapsedSeconds / estimatedSeconds);

  return { progress, elapsedSeconds: Math.round(elapsedSeconds), realProgress, onProgress };
}
