import { useState, useEffect, useCallback, useRef } from "react";
import { getApiError } from "../utils/error";

interface UseAsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

interface UseAsyncReturn<T> extends UseAsyncState<T> {
  execute: (keepData?: boolean | unknown) => Promise<void>;
  reset: () => void;
  setData: React.Dispatch<React.SetStateAction<T | null>>;
}

export function useAsync<T>(
  asyncFn: () => Promise<T>,
  immediate = false,
): UseAsyncReturn<T> {
  const [state, setState] = useState<UseAsyncState<T>>({
    data: null,
    loading: false,
    error: null,
  });
  const fnRef = useRef(asyncFn);
  fnRef.current = asyncFn;

  const execute = useCallback(async (keepData?: boolean | unknown) => {
    const shouldKeep = typeof keepData === "boolean" ? keepData : false;
    setState((prev) => ({
      data: shouldKeep ? prev.data : null,
      loading: true,
      error: null,
    }));
    try {
      const data = await fnRef.current();
      setState({ data, loading: false, error: null });
    } catch (err: unknown) {
      setState((prev) => ({
        data: shouldKeep ? prev.data : null,
        loading: false,
        error: getApiError(err),
      }));
    }
  }, []);

  const reset = useCallback(() => {
    setState({ data: null, loading: false, error: null });
  }, []);

  const setData = useCallback((action: React.SetStateAction<T | null>) => {
    setState((prev) => ({
      ...prev,
      data: typeof action === "function" ? (action as (prevState: T | null) => T | null)(prev.data) : action,
    }));
  }, []);

  useEffect(() => {
    if (immediate) {
      execute();
    }
  }, [execute, immediate]);

  return { ...state, execute, reset, setData };
}
