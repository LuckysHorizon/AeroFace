import cv2
import numpy as np
import mediapipe as mp
from fastapi import HTTPException

mp_face_mesh = mp.solutions.face_mesh.FaceMesh(
    static_image_mode=True,
    max_num_faces=1,
    refine_landmarks=True,
    min_detection_confidence=0.6
)


def extract_face_center(image: np.ndarray):
    rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
    result = mp_face_mesh.process(rgb)

    if not result.multi_face_landmarks:
        raise HTTPException(status_code=400, detail="Face landmarks not detected")

    landmarks = result.multi_face_landmarks[0].landmark

    xs = [lm.x for lm in landmarks]
    ys = [lm.y for lm in landmarks]

    center_x = np.mean(xs)
    center_y = np.mean(ys)

    return np.array([center_x, center_y])


def check_liveness(face_images: list) -> dict:
    """
    face_images: list of face crops (numpy arrays)
    """
    centers = []

    for img in face_images:
        center = extract_face_center(img)
        centers.append(center)

    centers = np.array(centers)

    # Measure movement between frames
    movements = np.linalg.norm(np.diff(centers, axis=0), axis=1)

    avg_movement = np.mean(movements)

    # Threshold (empirically safe for MVP)
    LIVENESS_THRESHOLD = 0.015

    is_live = avg_movement > LIVENESS_THRESHOLD

    return {
        "is_live": is_live,
        "liveness_score": round(float(avg_movement), 4)
    }