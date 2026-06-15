import { useEffect, useRef, useState } from "react";
import { WS_URL } from "../api/client";

export type WsStatus = "connecting" | "open" | "closed";

/**
 * Subscribe to a CivicOS WebSocket channel (e.g. `/ws/queue/12`).
 * Reconnects automatically with a small backoff. Returns the latest message
 * and the live connection status.
 */
export function useWebSocket<T = unknown>(path: string | null) {
  const [message, setMessage] = useState<T | null>(null);
  const [status, setStatus] = useState<WsStatus>("connecting");
  const wsRef = useRef<WebSocket | null>(null);
  const retryRef = useRef(0);
  const closedByUs = useRef(false);

  useEffect(() => {
    if (!path) return;
    closedByUs.current = false;

    let timer: ReturnType<typeof setTimeout>;

    const connect = () => {
      setStatus("connecting");
      const ws = new WebSocket(`${WS_URL}${path}`);
      wsRef.current = ws;

      ws.onopen = () => {
        retryRef.current = 0;
        setStatus("open");
      };
      ws.onmessage = (ev) => {
        try {
          setMessage(JSON.parse(ev.data) as T);
        } catch {
          /* ignore malformed frames */
        }
      };
      ws.onclose = () => {
        setStatus("closed");
        if (closedByUs.current) return;
        const delay = Math.min(1000 * 2 ** retryRef.current, 10000);
        retryRef.current += 1;
        timer = setTimeout(connect, delay);
      };
      ws.onerror = () => ws.close();
    };

    connect();

    return () => {
      closedByUs.current = true;
      clearTimeout(timer);
      wsRef.current?.close();
    };
  }, [path]);

  return { message, status };
}
