import numpy as np
import torch
from facenet_pytorch import InceptionResnetV1
from fastapi import HTTPException

_model = InceptionResnetV1(pretrained='vggface2').eval()

def _preprocess(face_bgr: np.ndarray) -> torch.Tensor:
    # BGR -> RGB
    face = face_bgr[:, :, ::-1]
    face = cv2.resize(face, (160, 160))
    face = face.astype(np.float32) / 255.0
    face = (face - 0.5) / 0.5  # normalize to [-1,1]
    t = torch.from_numpy(face).permute(2, 0, 1).unsqueeze(0)
    return t

def generate_embedding(face_bgr: np.ndarray) -> np.ndarray:
    try:
        with torch.no_grad():
            inp = _preprocess(face_bgr)
            emb = _model(inp).cpu().numpy().flatten()
    except Exception:
        raise HTTPException(status_code=500, detail="Embedding generation failed")

    if emb.shape[0] != 512:
        raise HTTPException(status_code=500, detail="Embedding dimension mismatch")

    # L2 normalize
    emb = emb / np.linalg.norm(emb)
    return emb