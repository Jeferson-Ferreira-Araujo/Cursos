import { useCallback, useEffect, useState } from 'react';
import { getErrorMessage } from '@/utils/errors';

type State<T> = { data: T | null; loading: boolean; error: string | null };

/** Small shared helper for the common "fetch on mount, pull to refresh, show error" screen pattern. */
export function useAsyncData<T>(fetcher: () => Promise<T>, deps: unknown[]) {
  const [state, setState] = useState<State<T>>({ data: null, loading: true, error: null });
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setState((s) => ({ ...s, loading: true, error: null }));
    }
    try {
      const data = await fetcher();
      setState({ data, loading: false, error: null });
    } catch (err) {
      setState({ data: null, loading: false, error: getErrorMessage(err) });
    } finally {
      setRefreshing(false);
    }
    // deps are provided by the caller and intentionally control refetching.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    load();
  }, [load]);

  return { ...state, refreshing, refresh: () => load(true), reload: () => load(false) };
}
