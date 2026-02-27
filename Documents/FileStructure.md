aeroface/
│
├── backend/
│
│   ├── gateway/                          # API Gateway
│   │   ├── app/
│   │   │   ├── main.py
│   │   │   ├── config.py
│   │   │   │
│   │   │   ├── middleware/
│   │   │   │   ├── auth_middleware.py
│   │   │   │   ├── rate_limit.py
│   │   │   │   └── logging_middleware.py
│   │   │   │
│   │   │   ├── routes/
│   │   │   │   ├── auth_routes.py
│   │   │   │   ├── verification_routes.py
│   │   │   │   ├── booking_routes.py
│   │   │   │   ├── face_routes.py
│   │   │   │   └── crm_routes.py
│   │   │   │
│   │   │   └── utils/
│   │   │       └── response_formatter.py
│   │   │
│   │   ├── requirements.txt
│   │   └── Dockerfile
│
│   ├── services/
│
│   │   ├── auth-service/
│   │   │   ├── app/
│   │   │   │   ├── main.py
│   │   │   │
│   │   │   │   ├── domain/
│   │   │   │   │   └── user.py
│   │   │   │
│   │   │   │   ├── application/
│   │   │   │   │   └── auth_usecases.py
│   │   │   │
│   │   │   │   ├── infrastructure/
│   │   │   │   │   ├── supabase_client.py
│   │   │   │   │   └── jwt_validator.py
│   │   │   │
│   │   │   │   ├── api/
│   │   │   │   │   └── routes.py
│   │   │   │
│   │   │   │   └── schemas/
│   │   │   │       └── user_schema.py
│   │   │
│   │   │   ├── requirements.txt
│   │   │   └── Dockerfile
│   │
│   │   ├── verification-service/
│   │   │   ├── app/
│   │   │   │   ├── main.py
│   │   │   │
│   │   │   │   ├── domain/
│   │   │   │   │   └── boarding_pass.py
│   │   │   │
│   │   │   │   ├── application/
│   │   │   │   │   └── verification_usecases.py
│   │   │   │
│   │   │   │   ├── infrastructure/
│   │   │   │   │   ├── qr_decoder.py
│   │   │   │   │   ├── iata_parser.py
│   │   │   │   │   └── flight_validator.py
│   │   │   │
│   │   │   │   ├── api/
│   │   │   │   │   └── routes.py
│   │   │   │
│   │   │   │   └── schemas/
│   │   │   │       └── boarding_schema.py
│   │   │
│   │   │   ├── requirements.txt
│   │   │   └── Dockerfile
│   │
│   │   ├── booking-service/
│   │   │   ├── app/
│   │   │   │   ├── main.py
│   │   │   │
│   │   │   │   ├── domain/
│   │   │   │   │   ├── booking.py
│   │   │   │   │   └── lounge.py
│   │   │   │
│   │   │   │   ├── application/
│   │   │   │   │   └── booking_usecases.py
│   │   │   │
│   │   │   │   ├── infrastructure/
│   │   │   │   │   ├── db_repository.py
│   │   │   │   │   ├── payment_gateway.py
│   │   │   │   │   └── cloudinary_client.py
│   │   │   │
│   │   │   │   ├── api/
│   │   │   │   │   └── routes.py
│   │   │   │
│   │   │   │   └── schemas/
│   │   │   │       ├── booking_schema.py
│   │   │   │       └── lounge_schema.py
│   │   │
│   │   │   ├── requirements.txt
│   │   │   └── Dockerfile
│   │
│   │   ├── face-service/
│   │   │   ├── app/
│   │   │   │   ├── main.py
│   │   │   │
│   │   │   │   ├── detection/
│   │   │   │   │   └── detector.py
│   │   │   │
│   │   │   │   ├── embedding/
│   │   │   │   │   └── generator.py
│   │   │   │
│   │   │   │   ├── liveness/
│   │   │   │   │   └── liveness_detector.py
│   │   │   │
│   │   │   │   ├── similarity/
│   │   │   │   │   └── matcher.py
│   │   │   │
│   │   │   │   ├── application/
│   │   │   │   │   └── face_usecases.py
│   │   │   │
│   │   │   │   ├── infrastructure/
│   │   │   │   │   └── vector_repository.py
│   │   │   │
│   │   │   │   ├── api/
│   │   │   │   │   └── routes.py
│   │   │   │
│   │   │   │   └── schemas/
│   │   │   │       └── face_schema.py
│   │   │
│   │   │   ├── requirements.txt
│   │   │   └── Dockerfile
│   │
│   │   ├── crm-service/
│   │   │   ├── app/
│   │   │   │   ├── main.py
│   │   │   │
│   │   │   │   ├── domain/
│   │   │   │   │   └── analytics.py
│   │   │   │
│   │   │   │   ├── application/
│   │   │   │   │   └── crm_usecases.py
│   │   │   │
│   │   │   │   ├── infrastructure/
│   │   │   │   │   └── analytics_repository.py
│   │   │   │
│   │   │   │   ├── api/
│   │   │   │   │   └── routes.py
│   │   │   │
│   │   │   │   └── schemas/
│   │   │   │       └── analytics_schema.py
│   │   │
│   │   │   ├── requirements.txt
│   │   │   └── Dockerfile
│
│   ├── shared/                             # Shared DTOs & utilities
│   │   ├── schemas/
│   │   │   ├── base_response.py
│   │   │   └── common_types.py
│   │   │
│   │   ├── constants/
│   │   │   ├── roles.py
│   │   │   └── config_constants.py
│   │   │
│   │   └── utils/
│   │       ├── datetime_utils.py
│   │       └── security_utils.py
│
│   ├── infra/
│   │   ├── docker-compose.yml
│   │   ├── nginx/
│   │   │   └── nginx.conf
│   │   ├── env/
│   │   │   ├── gateway.env
│   │   │   ├── auth.env
│   │   │   ├── booking.env
│   │   │   ├── verification.env
│   │   │   ├── face.env
│   │   │   └── crm.env
│   │   └── monitoring/
│   │       └── prometheus.yml
│
│   └── README.md
│
└── frontend/ (separate Next.js project)