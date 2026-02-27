from fastapi import FastAPI
from app.api.routes import router as face_router

app = FastAPI(title="Face Service")

app.include_router(face_router)
print('hello')