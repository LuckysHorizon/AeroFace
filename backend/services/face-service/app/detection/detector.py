import cv2
import numpy as np
import mediapipe as mp
from fastapi import HTTPException

_mp_fd = mp.solutions.face_detection.FaceDetection(
    model_selection=1,           # full-range
    min_detection_confidence=0.5
)

def detect_single_face(image_bytes: bytes) -> np.ndarray:
    np_img = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(np_img, cv2.IMREAD_COLOR)
    if img is None:
        raise HTTPException(status_code=400, detail="Invalid image data")

    h, w, _ = img.shape
    rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    res = _mp_fd.process(rgb)

    if not res.detections:
        raise HTTPException(status_code=400, detail="No face detected")
    if len(res.detections) > 1:
        raise HTTPException(status_code=400, detail="Multiple faces detected")

    bbox = res.detections[0].location_data.relative_bounding_box
    x = max(int(bbox.xmin * w), 0)
    y = max(int(bbox.ymin * h), 0)
    bw = min(int(bbox.width * w), w - x)
    bh = min(int(bbox.height * h), h - y)

    face = img[y:y+bh, x:x+bw]
    if face.size == 0:
        raise HTTPException(status_code=400, detail="Invalid face crop")

    return face