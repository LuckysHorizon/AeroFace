import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../detection')))

import cv2
import numpy as np
from generator import generate_embedding
from face_detector import FaceDetector
from dotenv import load_dotenv
import psycopg2

# Registration script: prompt for email and name, capture face, store embedding
load_dotenv()
conn = psycopg2.connect(os.environ["DATABASE_URL"])
cur = conn.cursor()

email = input("Enter your email: ").strip()
name = input("Enter your full name: ").strip()

cap = cv2.VideoCapture(0)
face_detector = FaceDetector()
print("Press 'c' to capture your face.")

while True:
    ret, frame = cap.read()
    if not ret:
        break
    faces = face_detector.detect_faces(frame)
    for (x, y, w, h) in faces:
        cv2.rectangle(frame, (x, y), (x+w, y+h), (255, 0, 0), 2)
    cv2.imshow("Register Face", frame)
    if cv2.waitKey(1) & 0xFF == ord('c'):
        if len(faces) > 0:
            x, y, w, h = faces[0]
            face_img = frame[y:y+h, x:x+w]
            face_img = cv2.resize(face_img, (160, 160))
            embedding = generate_embedding(face_img)
            # Update or insert user embedding
            cur.execute("SELECT id FROM public.users WHERE email = %s", (email,))
            result = cur.fetchone()
            if result:
                cur.execute("UPDATE public.users SET full_name = %s, embedding = %s WHERE email = %s", (name, embedding, email))
            else:
                import uuid
                user_id = str(uuid.uuid4())
                cur.execute("INSERT INTO public.users (id, full_name, email, embedding) VALUES (%s, %s, %s, %s)", (user_id, name, email, embedding))
            conn.commit()
            print(f"Registration successful for {name} ({email})!")
        else:
            print("No face detected. Try again.")
        break
cap.release()
cv2.destroyAllWindows()
cur.close()
conn.close()
