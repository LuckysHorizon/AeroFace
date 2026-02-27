✈ AeroFace
Biometric Lounge Access SaaS
SOFTWARE REQUIREMENTS SPECIFICATION (SRS)
1️⃣ Introduction
1.1 Purpose

This document defines the functional and non-functional requirements for AeroFace, a biometric SaaS platform that enables airport lounges to:

Verify passengers via boarding pass QR

Allow online lounge booking & payment

Register facial biometrics

Enable contactless face-based entry

Manage operations via CRM dashboard

1.2 Product Scope

AeroFace is a multi-tenant SaaS web application that:

Uses Supabase for authentication & database

Uses Cloudinary for secure image storage

Uses FastAPI for backend services

Uses Next.js for frontend

Uses AI face recognition for lounge entry

2️⃣ Overall Architecture
2.1 High-Level System Flow

Passenger
→ Next.js Frontend
→ Supabase Auth (JWT)
→ FastAPI Backend
→ Supabase PostgreSQL
→ Cloudinary (Images)
→ Face Recognition Engine
→ Lounge Entry Device

2.2 Architecture Components
Frontend

Next.js

Supabase JS SDK

Camera access (WebRTC)

Backend

FastAPI

SQLAlchemy

Supabase service role key

Face recognition microservice

Database

Supabase PostgreSQL

Row-Level Security enabled

Storage

Cloudinary (private folders + signed URLs)

3️⃣ Functional Requirements
3.1 Authentication Module (Supabase)
FR-1 User Registration

System shall allow:

Email/password registration

OTP verification

OAuth (Google optional)

FR-2 Login

System shall:

Authenticate using Supabase Auth

Generate JWT

Store secure session

FR-3 Role-Based Access

Roles:

Passenger

Lounge Admin

Super Admin

System shall enforce role-based access control.

3.2 Boarding Pass Verification
FR-4 Upload Boarding Pass

User shall:

Upload boarding pass image

Grant processing consent

FR-5 QR Decoding

System shall:

Decode QR (IATA BCBP format)

Extract:

Passenger name

Airline code

Flight number

Departure airport

Arrival airport

Flight date

Seat number

FR-6 Flight Validation

System shall validate:

Flight date matches current date

Departure airport matches lounge

Booking window valid

3.3 Lounge Booking Module
FR-7 Display Lounges

System shall:

Fetch lounges by airport

Show pricing & amenities

FR-8 Booking Creation

System shall:

Create booking record

Set validity time window

Associate with user

FR-9 Payment Integration

System shall:

Create payment session

Verify payment via webhook

Update booking status

3.4 Face Registration Module
FR-10 Camera Access

System shall request camera permission.

FR-11 Face Capture

System shall capture multiple face angles.

FR-12 Liveness Detection

System shall:

Detect blink / head movement

Prevent photo spoofing

FR-13 Embedding Generation

System shall:

Generate 512-dimension embedding

Normalize vector

FR-14 Storage

System shall:

Store embedding in PostgreSQL

Store image in Cloudinary

Save image URL in database

3.5 Lounge Entry Verification
FR-15 Real-Time Recognition

System shall:

Capture live face

Generate embedding

Compare with stored embeddings

FR-16 Access Validation

System shall verify:

Booking is active

Time window valid

Lounge matches booking

FR-17 Access Response

System shall:

Grant entry

Log event

Display welcome message

Response time: < 1 second

3.6 CRM & Admin Module
FR-18 Dashboard

Admin shall view:

Active guests

Daily revenue

Entry logs

Occupancy rate

FR-19 Manual Override

Admin shall:

Approve/reject entry manually

Extend booking

Blacklist user

FR-20 Analytics

System shall provide:

Peak hours

Revenue trends

Match accuracy statistics

4️⃣ Non-Functional Requirements
4.1 Performance

API response < 500ms

Face recognition < 1000ms

Concurrent users ≥ 1000

4.2 Security

Supabase JWT authentication

HTTPS mandatory

Row-Level Security (RLS)

Encrypted embeddings

Private Cloudinary folders

Signed URLs only

Rate limiting

4.3 Scalability

Multi-tenant schema

API horizontal scaling

Connection pooling

Indexing on embedding fields

4.4 Compliance

Explicit biometric consent

Data deletion mechanism

Audit logging

GDPR-ready architecture

5️⃣ Database Schema (Supabase PostgreSQL)
users (handled by Supabase Auth)

id (UUID)

email

role

created_at

profiles

user_id

full_name

phone

boarding_pass

id

user_id

airline_code

flight_number

departure_airport

arrival_airport

flight_date

seat_number

lounges

id

airport_code

terminal

pricing

capacity

bookings

id

user_id

lounge_id

status

start_time

expiry_time

face_embeddings

user_id

embedding_vector (pgvector)

image_url

liveness_score

entry_logs

id

user_id

lounge_id

timestamp

status

6️⃣ Technology Stack Summary
Layer	Technology
Frontend	Next.js
Auth	Supabase Auth
Database	Supabase PostgreSQL
Backend	FastAPI
AI	InsightFace + OpenCV
Storage	Cloudinary
Payment	Gateway Integration
7️⃣ Deliverables
Phase 1 – MVP

Supabase authentication

Boarding pass QR validation

Lounge booking module

Payment integration

Face registration

Live face verification

Basic CRM dashboard

Phase 2 – Production

Advanced liveness detection

Multi-airport support

Real-time analytics

High-speed vector search

Audit & compliance dashboard

🎯 Final Outcome

AeroFace will provide:

Contactless biometric lounge access

Secure SaaS architecture

Multi-tenant airport scalability

Real-time CRM monitoring

Secure biometric storage