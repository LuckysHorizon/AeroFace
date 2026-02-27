from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from app.detection.detector import detect_single_face
from app.liveness.liveness_detector import check_liveness
from app.embedding.generator import generate_embedding
from typing import List
import uuid

router = APIRouter()

ALLOWED_EXTENSIONS = {"jpg", "jpeg", "png"}
MIN_IMAGES = 1
MAX_IMAGES = 5


def _validate_image(file: UploadFile):
    if not file.filename:
        raise HTTPException(status_code=400, detail="Empty filename")

    ext = file.filename.split(".")[-1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type: {file.filename}"
        )


@router.post("/face/register")
async def register_face(
    user_id: str = Form(...),
    images: List[UploadFile] = File(...)
):
    print("RAW user_id:", repr(user_id))
    # ---- validate user_id ----
    try:
        uuid.UUID(user_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid user_id (not UUID)")

    # ---- validate images count ----
    if len(images) < MIN_IMAGES:
        raise HTTPException(
            status_code=400,
            detail=f"Minimum {MIN_IMAGES} images required"
        )

    if len(images) > MAX_IMAGES:
        raise HTTPException(
            status_code=400,
            detail=f"Maximum {MAX_IMAGES} images allowed"
        )

    # ---- validate each image ----
    faces = []
    for img in images:
        content = await img.read()
        face = detect_single_face(content)
        faces.append(face)

    # Liveness on face crops
    liveness = check_liveness(faces)
    if not liveness["is_live"]:
        raise HTTPException(400, "Liveness check failed (possible spoof)")

    # Generate embedding from first face
    embedding = generate_embedding(faces[0])

    return {
        "status": "face_registered",
        "user_id": user_id,
        "faces_detected": len(faces),
        "liveness_score": liveness["liveness_score"],
        "embedding_dim": len(embedding)
    }