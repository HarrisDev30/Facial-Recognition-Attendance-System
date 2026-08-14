import asyncio
import concurrent.futures
import os

import cv2
import insightface
import numpy as np
from app.config import settings

_app = None
_executor = concurrent.futures.ThreadPoolExecutor(max_workers=max(os.cpu_count() or 2, 2))


def shutdown_executor() -> None:
    _executor.shutdown(wait=True)


def _preprocess_image(img: np.ndarray) -> np.ndarray:
    h, w = img.shape[:2]
    max_dim = max(h, w)
    if max_dim > 1280:
        scale = 1280.0 / max_dim
        new_w = int(w * scale)
        new_h = int(h * scale)
        img = cv2.resize(img, (new_w, new_h), interpolation=cv2.INTER_AREA)

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    equalized = clahe.apply(gray)
    img = cv2.cvtColor(equalized, cv2.COLOR_GRAY2BGR)

    return img


def _get_model():
    global _app
    if _app is None:
        os.makedirs(settings.insightface_model_dir, exist_ok=True)
        _app = insightface.app.FaceAnalysis(
            name="buffalo_l",
            root=settings.insightface_model_dir,
            providers=settings.insightface_providers,
        )
        _app.prepare(ctx_id=0, det_thresh=settings.insightface_det_thresh)
    return _app


def _is_high_quality(face) -> bool:
    return face.det_score >= settings.insightface_min_det_score


def _detect_faces_sync(image_bytes: bytes) -> list[dict]:
    img_array = np.frombuffer(image_bytes, dtype=np.uint8)
    img = cv2.imdecode(img_array, cv2.IMREAD_COLOR)
    if img is None:
        return []

    img = _preprocess_image(img)

    model = _get_model()
    faces = model.get(img)
    h, w = img.shape[:2]

    results = []
    for face in faces:
        if not _is_high_quality(face):
            continue
        x1, y1, x2, y2 = [int(v) for v in face.bbox]
        results.append(
            {
                "bbox": [x1, y1, x2, y2],
                "det_score": float(face.det_score),
                "pose": [float(v) for v in face.pose],
                "face_width": x2 - x1,
                "face_height": y2 - y1,
                "img_width": w,
                "img_height": h,
            }
        )
    return results


def _extract_embeddings_sync(
    image_bytes: bytes,
    min_det_score: float = 0.0,
) -> list[tuple[bytes, float, dict]]:
    img_array = np.frombuffer(image_bytes, dtype=np.uint8)
    img = cv2.imdecode(img_array, cv2.IMREAD_COLOR)
    if img is None:
        return []

    img = _preprocess_image(img)

    model = _get_model()
    faces = model.get(img)
    h, w = img.shape[:2]

    results = []
    for face in faces:
        if face.det_score < min_det_score:
            continue
        emb = face.embedding.astype(np.float32).tobytes()
        x1, y1, x2, y2 = [int(v) for v in face.bbox]
        pose = [float(v) for v in face.pose]
        results.append(
            (
                emb,
                float(face.det_score),
                {
                    "det_score": float(face.det_score),
                    "pose": pose,
                    "bbox": [x1, y1, x2, y2],
                    "face_width": x2 - x1,
                    "face_height": y2 - y1,
                    "img_width": w,
                    "img_height": h,
                },
            )
        )
    return results


async def detect_faces(image_bytes: bytes) -> list[dict]:
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(_executor, _detect_faces_sync, image_bytes)


async def ensure_model_loaded():
    loop = asyncio.get_running_loop()
    await loop.run_in_executor(_executor, _get_model)


async def extract_embeddings(
    image_bytes: bytes,
    min_det_score: float = 0.0,
) -> list[tuple[bytes, float, dict]]:
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(
        _executor, _extract_embeddings_sync, image_bytes, min_det_score
    )
