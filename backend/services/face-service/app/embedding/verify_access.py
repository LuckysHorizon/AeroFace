import sys
import os
import time
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../detection')))

import cv2
import numpy as np
from generator import generate_embedding, cosine_similarity
from face_detector import FaceDetector
from dotenv import load_dotenv
import psycopg2

# Load environment variables for DB
load_dotenv()
conn = psycopg2.connect(os.environ["DATABASE_URL"])

# Query embeddings once
cur = conn.cursor()
cur.execute("SELECT email, full_name, embedding FROM public.users WHERE embedding IS NOT NULL")
users = cur.fetchall()
cur.close()
conn.close()

threshold = 0.7  # Adjust as needed

cap = cv2.VideoCapture(0)
face_detector = FaceDetector()
print("Press 'q' to quit.")

last_check_time = 0
check_interval = 1.0  # seconds
last_result = None
last_rect = None

while True:
    ret, frame = cap.read()
    if not ret:
        break
    faces = face_detector.detect_faces(frame)
    current_time = time.time()
    if len(faces) > 0:
        x, y, w, h = faces[0]
        face_img = frame[y:y+h, x:x+w]
        face_img = cv2.resize(face_img, (160, 160))
        if current_time - last_check_time > check_interval:
            embedding = generate_embedding(face_img)
            best_match = None
            best_similarity = 0
            for email, full_name, stored_embedding in users:
                similarity = cosine_similarity(embedding, stored_embedding)
                if similarity > best_similarity:
                    best_similarity = similarity
                    best_match = (email, full_name)
            color = (0, 0, 255)  # Red by default
            label = f"Access Denied | Accuracy: {best_similarity:.2f}"
            if best_match and best_similarity >= threshold:
                color = (0, 255, 0)  # Green
                label = f"Access Granted: {best_match[1]} | Accuracy: {best_similarity:.2f}"
            last_result = (label, color)
            last_rect = (x, y, w, h)
            last_check_time = current_time
        # Draw last result
        if last_result and last_rect:
            label, color = last_result
            x, y, w, h = last_rect
            cv2.rectangle(frame, (x, y), (x+w, y+h), color, 2)
            cv2.putText(frame, label, (x, y-10), cv2.FONT_HERSHEY_SIMPLEX, 0.7, color, 2)
    cv2.imshow("Live Access Verification", frame)
    if cv2.waitKey(1) & 0xFF == ord('q'):
        break
cap.release()
cv2.destroyAllWindows()
