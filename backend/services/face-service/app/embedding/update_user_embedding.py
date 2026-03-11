import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../detection')))

import cv2
import numpy as np
from generator import generate_embedding
from face_detector import FaceDetector
from dotenv import load_dotenv
import psycopg2

# Prompt for user email
user_email = input("Enter the user's email to update embedding: ").strip()

# Load environment variables for DB
load_dotenv()
conn = psycopg2.connect(os.environ["DATABASE_URL"])

# Capture face from webcam
cap = cv2.VideoCapture(0)
face_detector = FaceDetector()
print("Press 'c' to capture face.")
img = None
faces = []
while True:
    ret, frame = cap.read()
    if not ret:
        break
    faces = face_detector.detect_faces(frame)
    for (x, y, w, h) in faces:
        cv2.rectangle(frame, (x, y), (x+w, y+h), (255, 0, 0), 2)  # Blue rectangle for detected face
    cv2.imshow("Capture Face", frame)
    if cv2.waitKey(1) & 0xFF == ord('c'):
        img = frame.copy()
        break
cap.release()
cv2.destroyAllWindows()

if img is None or len(faces) == 0:
    print("No face detected.")
    conn.close()
    exit()

# Extract face region
x, y, w, h = faces[0]
face_img = img[y:y+h, x:x+w]

# Generate embedding
embedding = generate_embedding(face_img)

# Update embedding in database for the given email
cur = conn.cursor()
cur.execute("UPDATE public.users SET embedding = %s WHERE email = %s", (embedding, user_email))
conn.commit()
cur.close()
conn.close()
print(f"Embedding updated for user: {user_email}")
