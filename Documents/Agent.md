AeroFace
Agent-Based Phase Planning Documentation

Version 1.0

1. Purpose of This Document

This document defines:

Development phases

Agent ownership model

Deliverables per phase

Dependencies between services

Execution order

Risk mitigation

Milestone targets

AeroFace is built using independent service “agents” where each service operates autonomously with minimal coupling.

2. System Agent Model

Each major system module is treated as an independent agent.

Core Agents

Auth Agent

Verification Agent

Booking Agent

Payment Agent

Face AI Agent

CRM Agent

Gateway Agent

Frontend Agent

DevOps Agent

Each agent:

Owns its domain

Has independent service

Has separate deployment container

Does not directly access other agent databases

3. Phase Breakdown Overview
Phase	Focus	Goal
Phase 0	Foundation	Infrastructure & Repo Setup
Phase 1	Core Auth & Verification	User onboarding flow
Phase 2	Booking & Payment	Revenue functionality
Phase 3	Face AI Integration	Biometric access
Phase 4	CRM & Admin	Operational control
Phase 5	Hardening & Scaling	Production readiness
4. Phase 0 – Foundation
Objective

Prepare clean architecture and infrastructure.

Agents Active

DevOps Agent

Gateway Agent

Frontend Agent

Database Setup

Deliverables

Monorepo structure created

Docker setup

Supabase project configured

Cloudinary configured

Environment configs

API Gateway skeleton

CI/CD baseline

Logging setup

Success Criteria

All services start locally

Gateway routes successfully

Supabase auth working

5. Phase 1 – Authentication & Boarding Verification
Objective

Enable verified passenger onboarding.

Active Agents
1. Auth Agent

Supabase JWT validation

Role system

Middleware protection

2. Verification Agent

QR decoding

IATA BCBP parsing

Date & airport validation

3. Frontend Agent

Login screen

Boarding pass upload screen

Parsed result preview

Deliverables

User login flow

Boarding pass validation flow

Flight data stored in DB

Secure session handling

Dependencies

Verification Agent depends on:

Auth Agent for user identity

Success Criteria

User uploads boarding pass

Flight data extracted correctly

System validates airport match

6. Phase 2 – Booking & Payment
Objective

Enable monetization.

Active Agents
1. Booking Agent

Lounge listing

Booking creation

Time window logic

2. Payment Agent

Order creation

Webhook verification

Status update

3. Frontend Agent

Lounge selection UI

Payment redirect

Booking confirmation

Deliverables

Lounge booking system

Booking expiry logic

Payment confirmation

Booking record stored

Dependencies

Verification must be completed

Auth must be stable

Success Criteria

User can book lounge

Booking marked paid

Validity window enforced

7. Phase 3 – Face AI Integration
Objective

Enable biometric entry.

Active Agents
1. Face AI Agent

Face detection

Embedding generation

Liveness detection

Similarity search

2. Booking Agent

Active booking validation

3. Frontend Agent

Camera capture screen

Registration confirmation

Deliverables

Face registration flow

Embedding stored in DB

Real-time matching endpoint

Entry approval response

Dependencies

Booking must exist

Supabase user linked

Cloudinary working

Success Criteria

Face registers successfully

Matching under 1 second

Only valid bookings accepted

8. Phase 4 – CRM & Admin
Objective

Operational management tools.

Active Agents
1. CRM Agent

Revenue analytics

Entry logs

Occupancy calculation

2. Admin UI Agent

Dashboard

Logs table

Manual override

Deliverables

Admin dashboard

Entry monitoring

Revenue stats

Audit logs

Dependencies

Face entry logging implemented

Success Criteria

Real-time logs visible

Metrics accurate

Manual override functional

9. Phase 5 – Hardening & Production Readiness
Objective

Make AeroFace deployable to airports.

Active Agents

All agents

Deliverables

Rate limiting

Error handling standardization

Security testing

Load testing

Performance tuning

Monitoring (Prometheus)

Logging aggregation

Backup strategy

Security Hardening

RLS validation

Signed Cloudinary URLs

Encrypted embeddings

Input validation

XSS prevention

CORS protection

Success Criteria

99% uptime under load

Face matching < 1 sec

No cross-tenant data leak

10. Inter-Agent Communication Model

All requests flow:

Frontend
→ Gateway Agent
→ Target Agent

Agents do not call each other directly.

Future enhancement:

Event queue for booking-created event

Event queue for entry-logged event

11. Development Sprint Model

Recommended Sprint Plan:

Sprint 1:

Phase 0 + Phase 1

Sprint 2:

Phase 2

Sprint 3:

Phase 3

Sprint 4:

Phase 4

Sprint 5:

Phase 5 hardening

Each sprint:

Code review

Security review

Integration testing

12. Risk Planning
Risk	Phase	Mitigation
QR parsing errors	Phase 1	Extensive test cases
Payment webhook failure	Phase 2	Retry logic
Face spoofing	Phase 3	Liveness detection
Slow embedding search	Phase 3	pgvector indexing
Multi-tenant leakage	Phase 5	Strict RLS policies
13. Milestone Roadmap

Milestone 1:
User can login and verify flight.

Milestone 2:
User can book lounge and pay.

Milestone 3:
User can register face.

Milestone 4:
User enters lounge via face.

Milestone 5:
Admin dashboard operational.

Milestone 6:
Production hardened.

14. Agent Ownership Matrix
Agent	Owner	Scope
Auth	Backend Dev 1	Supabase auth
Verification	Backend Dev 2	QR parsing
Booking	Backend Dev 3	Booking logic
Payment	Backend Dev 3	Payment integration
Face AI	ML Engineer	Recognition
CRM	Backend Dev 4	Analytics
Gateway	Backend Lead	Routing
Frontend	Frontend Dev	UI
DevOps	DevOps Engineer	Deployment
15. Final Architecture Outcome

At the end of all phases:

AeroFace becomes:

Modular

Secure

Revenue-generating

Biometric-enabled

Enterprise SaaS ready

Scalable across airports