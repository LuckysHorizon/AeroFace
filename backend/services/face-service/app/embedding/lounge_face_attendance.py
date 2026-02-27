import sys
import os
import time
from datetime import datetime
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
cur = conn.cursor()

# Query embeddings and user ids
cur.execute("SELECT id, email, full_name, embedding FROM public.users WHERE embedding IS NOT NULL")
users = cur.fetchall()

# Set your lounge_id here (replace with actual lounge id)
lounge_id = input("Enter lounge_id: ").strip()

threshold = 0.7  # Adjust as needed

cap = cv2.VideoCapture(0)
face_detector = FaceDetector()
print("Press 'q' to quit.")

last_check_time = 0
check_interval = 1.0  # seconds
last_result = None
last_rect = None
checkin_times = {}
checkout_times = {}

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
            best_user_id = None
            for user_id, email, full_name, stored_embedding in users:
                similarity = cosine_similarity(embedding, stored_embedding)
                if similarity > best_similarity:
                    best_similarity = similarity
                    best_match = (email, full_name)
                    best_user_id = user_id
            color = (0, 0, 255)  # Red by default
            label = f"Access Denied"
            if best_match and best_similarity >= threshold:
                color = (0, 255, 0)  # Green
                label = f"{best_match[1] if best_match[1] else best_match[0]}"
                # Check-in logic
                if best_user_id not in checkin_times:
                    checkin_times[best_user_id] = datetime.now()
                    # Store check-in in DB
                    cur.execute("INSERT INTO lounge_attendance (user_id, lounge_id, checkin_time) VALUES (%s, %s, %s)", (best_user_id, lounge_id, checkin_times[best_user_id]))
                    conn.commit()
                # Check-out logic (if already checked in and detected again after 10 seconds)
                elif best_user_id in checkin_times and best_user_id not in checkout_times and (datetime.now() - checkin_times[best_user_id]).seconds > 10:
                    checkout_times[best_user_id] = datetime.now()
                    # Store checkout in DB
                    cur.execute("UPDATE lounge_attendance SET checkout_time = %s WHERE user_id = %s AND lounge_id = %s AND checkin_time = %s", (checkout_times[best_user_id], best_user_id, lounge_id, checkin_times[best_user_id]))
                    conn.commit()
            last_result = (label, color)
            last_rect = (x, y, w, h)
            last_check_time = current_time
        # Draw last result
        if last_result and last_rect:
            label, color = last_result
            x, y, w, h = last_rect
            cv2.rectangle(frame, (x, y), (x+w, y+h), color, 2)
            cv2.putText(frame, label, (x, y-10), cv2.FONT_HERSHEY_SIMPLEX, 0.9, color, 2)
    cv2.imshow("Lounge Face Attendance", frame)
    if cv2.waitKey(1) & 0xFF == ord('q'):
        break
cap.release()
cv2.destroyAllWindows()
cur.close()
conn.close()
