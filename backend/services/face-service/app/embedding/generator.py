# Example: Add embedding column to users table
# ALTER TABLE public.users ADD COLUMN embedding BYTEA;

# Registration logic (store embedding)
from dotenv import load_dotenv
def store_user_embedding(user_id, embedding, conn):
    cur = conn.cursor()
    cur.execute("UPDATE public.users SET embedding = %s WHERE id = %s", (embedding, user_id))
    conn.commit()
    cur.close()

# Check-in logic (compare embedding)
def verify_user_embedding(user_id, new_embedding, conn, threshold=0.7):
    cur = conn.cursor()
    cur.execute("SELECT embedding FROM public.users WHERE id = %s", (user_id,))
    result = cur.fetchone()
    cur.close()
    if result is None:
        return False
    stored_embedding = result[0]
    # Compare embeddings (example: cosine similarity)
    similarity = cosine_similarity(new_embedding, stored_embedding)
    return similarity >= threshold

# Helper function for cosine similarity
def cosine_similarity(a, b):
    import numpy as np
    a = np.frombuffer(a, dtype=np.float32)
    b = np.frombuffer(b, dtype=np.float32)
    return np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b))

# Sample registration flow for a new user
import uuid

def register_new_user(full_name, email, phone, embedding, conn):
    user_id = str(uuid.uuid4())
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO public.users (id, full_name, email, phone, embedding) VALUES (%s, %s, %s, %s, %s)",
        (user_id, full_name, email, phone, embedding)
    )
    conn.commit()
    cur.close()
    return user_id

# Identification workflow: find user by face embedding

def identify_user_by_embedding(new_embedding, conn, threshold=0.7):
    import numpy as np
    cur = conn.cursor()
    cur.execute("SELECT id, full_name, embedding FROM public.users WHERE embedding IS NOT NULL")
    users = cur.fetchall()
    cur.close()
    for user_id, full_name, stored_embedding in users:
        similarity = cosine_similarity(new_embedding, stored_embedding)
        if similarity >= threshold:
            return {"user_id": user_id, "full_name": full_name, "similarity": similarity}
    return None

# Example usage:
# new_embedding = ... # Generate from detected face
# conn = ... # Your database connection
# result = identify_user_by_embedding(new_embedding, conn)
# if result:
#     print(f"Access granted to {result['full_name']} (Similarity: {result['similarity']:.2f})")
# else:
#     print("Access denied: No matching user found.")

import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../detection')))

import cv2
from face_detector import FaceDetector
from deepface import DeepFace

def generate_embedding(face_img):
    # DeepFace expects RGB images
    import cv2
    import numpy as np
    from deepface import DeepFace
    rgb_img = cv2.cvtColor(face_img, cv2.COLOR_BGR2RGB)
    # Set enforce_detection=False to avoid errors if DeepFace can't detect a face
    embedding = DeepFace.represent(rgb_img, model_name='Facenet', enforce_detection=False)[0]['embedding']
    # Convert embedding to bytes for storage
    embedding_bytes = np.array(embedding, dtype=np.float32).tobytes()
    return embedding_bytes

# Example usage:
# new_embedding = generate_embedding(face_img)
# conn = ... # Your database connection
# result = identify_user_by_embedding(new_embedding, conn)
# if result:
#     print(f"Access granted to {result['full_name']} (Similarity: {result['similarity']:.2f})")
# else:
#     print("Access denied: No matching user found.")