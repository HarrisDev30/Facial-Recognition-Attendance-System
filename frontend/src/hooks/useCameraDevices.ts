import { useState, useEffect, useCallback } from "react";

export interface CameraDevice {
  deviceId: string;
  label: string;
}

interface UseCameraDevicesReturn {
  devices: CameraDevice[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useCameraDevices(): UseCameraDevicesReturn {
  const [devices, setDevices] = useState<CameraDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const enumerate = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const all = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = all.filter((d) => d.kind === "videoinput");

      if (videoInputs.some((d) => !d.label)) {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        stream.getTracks().forEach((t) => t.stop());
        const refreshed = await navigator.mediaDevices.enumerateDevices();
        const filtered = refreshed.filter((d) => d.kind === "videoinput");
        setDevices(
          filtered.map((d) => ({
            deviceId: d.deviceId,
            label: d.label || `Camera ${filtered.indexOf(d) + 1}`,
          })),
        );
      } else {
        setDevices(
          videoInputs.map((d) => ({
            deviceId: d.deviceId,
            label: d.label || `Camera ${videoInputs.indexOf(d) + 1}`,
          })),
        );
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to enumerate cameras";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    enumerate();
  }, [enumerate]);

  return { devices, loading, error, refresh: enumerate };
}
