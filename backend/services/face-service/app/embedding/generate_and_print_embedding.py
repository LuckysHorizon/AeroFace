import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../detection')))

import cv2
import numpy as np
from generator import generate_embedding
from face_detector import FaceDetector
from dotenv import load_dotenv

# Load environment variables for DB
load_dotenv()

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
    exit()

# Extract face region
x, y, w, h = faces[0]
face_img = img[y:y+h, x:x+w]

# Generate embedding
embedding = generate_embedding(face_img)

# Print embedding as hex string for easy copy-paste
print("Generated embedding (hex):")
print(embedding.hex())

# Optionally, print embedding as numpy array
arr = np.frombuffer(embedding, dtype=np.float32)
print("Embedding as numpy array:")
print(arr)
