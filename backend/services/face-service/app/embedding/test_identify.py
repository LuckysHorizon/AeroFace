import cv2
import numpy as np
import psycopg2
from dotenv import load_dotenv
import os
from generator import identify_user_by_embedding, generate_embedding
from detection.face_detector import FaceDetector

# Load environment variables for DB
load_dotenv()
conn = psycopg2.connect(os.environ["DATABASE_URL"])

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

# Identify user
result = identify_user_by_embedding(embedding, conn)
if result:
    print(f"Access granted to {result['full_name']} (Similarity: {result['similarity']:.2f})")
else:
    print("Access denied: No matching user found.")
conn.close()
