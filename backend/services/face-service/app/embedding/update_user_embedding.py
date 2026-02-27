import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../detection')))

import cv2
import numpy as np
from generator import generate_embedding
from face_detector import FaceDetector
from dotenv import load_dotenv
import psycopg2

# Load environment variables for DB
load_dotenv()
conn = psycopg2.connect(os.environ["DATABASE_URL"])

# User email to update
user_email = 'sreeharshah.2006@gmail.com'

# Capture face from webcam
cap = cv2.VideoCapture(0)
print("Press 'c' to capture face.")
while True:
    ret, frame = cap.read()
    if not ret:
        break
    cv2.imshow("Capture Face", frame)
    if cv2.waitKey(1) & 0xFF == ord('c'):
        img = frame.copy()
        break
cap.release()
cv2.destroyAllWindows()

# Detect face
face_detector = FaceDetector()
faces = face_detector.detect_faces(img)
if len(faces) == 0:
    print("No face detected.")
    conn.close()
    exit()

# Extract face region
x, y, w, h = faces[0]
face_img = img[y:y+h, x:x+w]

# Generate embedding
embedding = generate_embedding(face_img)

# Update embedding in database
cur = conn.cursor()
cur.execute("UPDATE public.users SET embedding = %s WHERE email = %s", (embedding, user_email))
conn.commit()
cur.close()
conn.close()
print(f"Embedding updated for user: {user_email}")
