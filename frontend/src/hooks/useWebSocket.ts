import { useEffect, useRef, useState, useCallback } from "react";
import { buildWsUrl } from "../api/scanner";

interface UseWebSocketOptions {
  onMessage?: (data: any) => void;
  onOpen?: () => void;
  onClose?: () => void;
  onError?: (err: Event) => void;
}

interface UseWebSocketReturn {
  connectionStatus: "connecting" | "connected" | "disconnected" | "error";
  fps: number;
  errorLog: string[];
  pushError: (msg: string) => void;
  send: (data: string) => void;
  clearErrors: () => void;
}

export function useWebSocket(
  sessionId: string,
  options?: UseWebSocketOptions,
): UseWebSocketReturn {
  const wsRef = useRef<WebSocket | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<"connecting" | "connected" | "disconnected" | "error">("disconnected");
  const [fps, setFps] = useState(0);
  const [errorLog, setErrorLog] = useState<string[]>([]);
  const frameTimesRef = useRef<number[]>([]);
  const retriesRef = useRef(0);
  const maxRetriesRef = useRef(5);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pushError = useCallback((msg: string) => {
    setErrorLog((prev) => [...prev.slice(-49), `[${new Date().toLocaleTimeString()}] ${msg}`]);
  }, []);

  const clearErrors = useCallback(() => {
    setErrorLog([]);
  }, []);

  const send = useCallback((data: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(data);
    }
  }, []);

  useEffect(() => {
    if (!sessionId) return;

    let cleanedUp = false;

    function connect() {
      if (cleanedUp) return;
      setConnectionStatus("connecting");
      const ws = new WebSocket(buildWsUrl(sessionId));
      wsRef.current = ws;

      ws.onopen = () => {
        setConnectionStatus("connected");
        retriesRef.current = 0;
        options?.onOpen?.();
      };

      ws.onmessage = (event) => {
        frameTimesRef.current.push(performance.now());
        if (frameTimesRef.current.length > 30) {
          frameTimesRef.current = frameTimesRef.current.slice(-30);
        }
        if (frameTimesRef.current.length >= 2) {
          const elapsed = frameTimesRef.current[frameTimesRef.current.length - 1] - frameTimesRef.current[0];
          const computedFps = Math.round(((frameTimesRef.current.length - 1) / elapsed) * 1000);
          setFps(Math.min(computedFps, 60));
        }
        try {
          const data = JSON.parse(event.data);
          options?.onMessage?.(data);
        } catch {
          // non-JSON message
        }
      };

      ws.onclose = () => {
        if (cleanedUp) return;
        setConnectionStatus("disconnected");
        options?.onClose?.();
        const retries = retriesRef.current;
        if (retries < maxRetriesRef.current) {
          const delay = Math.min(1000 * 2 ** retries, 30000);
          pushError(`WebSocket disconnected — reconnecting in ${delay / 1000}s...`);
          timerRef.current = setTimeout(() => {
            retriesRef.current = retries + 1;
            connect();
          }, delay);
        } else {
          pushError("WebSocket disconnected — max retries reached");
        }
      };

      ws.onerror = (event) => {
        setConnectionStatus("error");
        pushError("WebSocket connection error");
        options?.onError?.(event);
      };
    }

    connect();

    return () => {
      cleanedUp = true;
      if (timerRef.current) clearTimeout(timerRef.current);
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [sessionId]);

  return { connectionStatus, fps, errorLog, pushError, send, clearErrors };
}
