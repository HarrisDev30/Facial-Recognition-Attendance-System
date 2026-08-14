import cv2
import numpy as np


def decode_image(image_bytes: bytes) -> np.ndarray | None:
    arr = np.frombuffer(image_bytes, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    return img


def draw_detection_zone(
    img: np.ndarray, zone: dict | None
) -> np.ndarray:
    if zone is None:
        return img
    x1 = zone.get("x1", 0)
    y1 = zone.get("y1", 0)
    x2 = zone.get("x2", img.shape[1])
    y2 = zone.get("y2", img.shape[0])
    cv2.rectangle(img, (x1, y1), (x2, y2), (0, 255, 0), 2)
    return img


def is_in_zone(x: int, y: int, zone: dict | None, img_w: int, img_h: int) -> bool:
    if zone is None:
        return True
    x1 = zone.get("x1", 0)
    y1 = zone.get("y1", 0)
    x2 = zone.get("x2", img_w)
    y2 = zone.get("y2", img_h)
    return x1 <= x <= x2 and y1 <= y <= y2
