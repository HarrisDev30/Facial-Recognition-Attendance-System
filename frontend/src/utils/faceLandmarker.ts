import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";

export interface FaceOrientation {
  detected: boolean;
  faceCount: number;
  yaw: number; // Left (positive) / Right (negative) in degrees (-60 to +60)
  pitch: number; // Up (positive) / Down (negative) in degrees (-50 to +50)
  roll: number;
  faceCoverage: number; // 0.0 to 1.0 (relative area of face in frame)
  centerX?: number; // Normalized center (-1 to +1)
  centerY?: number; // Normalized center (-1 to +1)
}

let landmarkerInstance: FaceLandmarker | null = null;
let initPromise: Promise<FaceLandmarker | null> | null = null;

export async function getFaceLandmarker(): Promise<FaceLandmarker | null> {
  if (landmarkerInstance) return landmarkerInstance;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm",
      );

      // Attempt GPU acceleration first, fallback to CPU if WebGL is unavailable
      let landmarker: FaceLandmarker;
      try {
        landmarker = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
            delegate: "GPU",
          },
          outputFaceBlendshapes: false,
          outputFacialTransformationMatrixes: true,
          runningMode: "VIDEO",
          numFaces: 2,
        });
      } catch (gpuErr) {
        console.warn("GPU delegate failed, falling back to CPU for MediaPipe:", gpuErr);
        landmarker = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
            delegate: "CPU",
          },
          outputFaceBlendshapes: false,
          outputFacialTransformationMatrixes: true,
          runningMode: "VIDEO",
          numFaces: 2,
        });
      }

      landmarkerInstance = landmarker;
      return landmarker;
    } catch (err) {
      console.warn("Failed to initialize MediaPipe FaceLandmarker:", err);
      return null;
    }
  })();

  return initPromise;
}

let lastVideoTime = -1;

/**
 * Calculates head pose angles (yaw, pitch, roll) from 468 3D landmarks or transformation matrix
 */
export function estimateFaceOrientation(
  landmarker: FaceLandmarker | null,
  video: HTMLVideoElement,
  timestampMs: number,
): FaceOrientation {
  const defaultOrientation: FaceOrientation = {
    detected: false,
    faceCount: 0,
    yaw: 0,
    pitch: 0,
    roll: 0,
    faceCoverage: 0,
    centerX: 0,
    centerY: 0,
  };

  if (!video || video.videoWidth === 0 || video.videoHeight === 0 || !landmarker) {
    return defaultOrientation;
  }

  // Ensure timestamp is strictly increasing for MediaPipe VIDEO mode
  const safeTime = timestampMs > lastVideoTime ? timestampMs : lastVideoTime + 1;
  lastVideoTime = safeTime;

  try {
    const results = landmarker.detectForVideo(video, safeTime);

    if (!results.faceLandmarks || results.faceLandmarks.length === 0) {
      return defaultOrientation;
    }

    const faceCount = results.faceLandmarks.length;
    const landmarks = results.faceLandmarks[0];

    // Key Landmarks for geometric pose estimation
    // 1: Nose tip, 33: Left eye outer, 263: Right eye outer, 152: Chin, 10: Forehead center
    const nose = landmarks[1];
    const leftEye = landmarks[33];
    const rightEye = landmarks[263];
    const chin = landmarks[152];
    const forehead = landmarks[10];

    // Compute Face Bounding Coverage
    let minX = 1, maxX = 0, minY = 1, maxY = 0;
    for (const lm of landmarks) {
      if (lm.x < minX) minX = lm.x;
      if (lm.x > maxX) maxX = lm.x;
      if (lm.y < minY) minY = lm.y;
      if (lm.y > maxY) maxY = lm.y;
    }
    const faceWidth = maxX - minX;
    const faceHeight = maxY - minY;
    const faceCoverage = faceWidth * faceHeight;
    const centerX = (minX + maxX) / 2 * 2 - 1; // -1 (left) to +1 (right)
    const centerY = (minY + maxY) / 2 * 2 - 1; // -1 (top) to +1 (bottom)

    // Direct matrix calculation if available from MediaPipe
    if (results.facialTransformationMatrixes && results.facialTransformationMatrixes.length > 0) {
      const mat = results.facialTransformationMatrixes[0].data;
      // Rotation matrix to Euler angles (ZYX convention)
      const r02 = mat[2];
      const r10 = mat[4], r11 = mat[5], r12 = mat[6];
      const r22 = mat[10];

      // Pitch (X-rotation), Yaw (Y-rotation), Roll (Z-rotation) in degrees
      const pitch = Math.asin(-r12) * (180 / Math.PI);
      const yaw = Math.atan2(r02, r22) * (180 / Math.PI);
      const roll = Math.atan2(r10, r11) * (180 / Math.PI);

      return {
        detected: true,
        faceCount,
        yaw: -yaw, // Mirror coordinate adjustment for selfie cam
        pitch,
        roll,
        faceCoverage,
        centerX,
        centerY,
      };
    }

    // Geometric Fallback calculation
    const eyeMidX = (leftEye.x + rightEye.x) / 2;
    const eyeDist = Math.hypot(rightEye.x - leftEye.x, rightEye.y - leftEye.y);

    // Yaw: Nose horizontal offset relative to eye midpoint normalized by eye distance
    const yawOffset = (nose.x - eyeMidX) / (eyeDist || 1);
    const yaw = Math.max(-60, Math.min(60, yawOffset * 110));

    // Pitch: Nose vertical offset relative to forehead-chin midpoint
    const faceMidY = (forehead.y + chin.y) / 2;
    const faceLength = Math.abs(chin.y - forehead.y);
    const pitchOffset = (faceMidY - nose.y) / (faceLength || 1);
    const pitch = Math.max(-50, Math.min(50, pitchOffset * 100));

    return {
      detected: true,
      faceCount,
      yaw,
      pitch,
      roll: 0,
      faceCoverage,
      centerX,
      centerY,
    };
  } catch (err) {
    return defaultOrientation;
  }
}
