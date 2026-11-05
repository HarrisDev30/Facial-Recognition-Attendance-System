import { useRef, useState, useCallback } from "react";

interface UseCameraOptions {
  deviceId?: string;
}

interface UseCameraReturn {
  videoRef: React.RefObject<HTMLVideoElement>;
  streamRef: React.MutableRefObject<MediaStream | null>;
  cameraActive: boolean;
  error: string | null;
  startCamera: (customDeviceId?: string | unknown) => Promise<void>;
  stopCamera: () => void;
  captureFrame: () => string | null;
  captureBlob: (type?: string, quality?: number) => Promise<Blob | null>;
}

export function useCamera(options?: UseCameraOptions): UseCameraReturn {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  }, []);

  const startCamera = useCallback(async (customDeviceId?: string | unknown) => {
    try {
      setError(null);
      // Stop previous tracks if already running
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      const targetId = typeof customDeviceId === "string" ? customDeviceId : options?.deviceId;
      const constraints: MediaStreamConstraints = {
        video: targetId
          ? { deviceId: { exact: targetId }, width: { ideal: 1280 }, height: { ideal: 720 } }
          : { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setCameraActive(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Camera access denied";
      setError(message);
    }
  }, [options?.deviceId]);

  const captureFrame = useCallback((): string | null => {
    const video = videoRef.current;
    if (!video) return null;
    const canvas = canvasRef.current ?? (canvasRef.current = document.createElement("canvas"));
    const width = video.videoWidth || 640;
    const height = video.videoHeight || 480;
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0);
    return canvas.toDataURL("image/jpeg", 0.8);
  }, []);

  const captureBlob = useCallback(
    (type = "image/jpeg", quality = 0.85): Promise<Blob | null> => {
      return new Promise((resolve) => {
        const video = videoRef.current;
        if (!video) {
          resolve(null);
          return;
        }
        const canvas = canvasRef.current ?? (canvasRef.current = document.createElement("canvas"));
        const width = video.videoWidth || 640;
        const height = video.videoHeight || 480;
        if (canvas.width !== width) canvas.width = width;
        if (canvas.height !== height) canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(null);
          return;
        }
        ctx.drawImage(video, 0, 0);
        canvas.toBlob(
          (blob) => {
            resolve(blob);
          },
          type,
          quality,
        );
      });
    },
    [],
  );

  return {
    videoRef,
    streamRef,
    cameraActive,
    error,
    startCamera,
    stopCamera,
    captureFrame,
    captureBlob,
  };
}
