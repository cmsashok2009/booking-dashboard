# Booking Dashboard

Role-based booking operations product with a Next.js frontend, Node API, MySQL persistence, Redis rate limiting, and container packaging.

## Portable Docker installation

Requirements: Docker Engine/Desktop with Compose v2.

    .\scripts\generate-docker-env.ps1 -AdminEmail "admin@your-company.com"
    docker compose --env-file .env.docker up --build -d
    docker compose --env-file .env.docker ps

Open http://localhost:3000. The generated administrator password is stored only in the ignored .env.docker file and must be changed at first sign-in.

The stack contains production Next.js and Node services, durable MySQL state, Redis rate limiting, and an idempotent one-time database initializer. No mock bookings or mock operational users are inserted.

Stop without deleting data:

    docker compose --env-file .env.docker down

Do not add -v unless you intentionally want to delete the MySQL and Redis volumes.

## Server deployment

1. Point a domain to the VPS.
2. Put Caddy, Nginx, or a load balancer in front of port 3000.
3. Enable HTTPS.
4. Set APP_URL=https://your-domain.example and SESSION_COOKIE_SECURE=true.
5. Keep .env.docker out of Git with owner-only permissions.
6. Configure scheduled MySQL backups before importing customer data.
7. Configure Gmail OAuth values when real invitation delivery is required.

Published image variables:

    BACKEND_IMAGE=ghcr.io/OWNER/REPOSITORY-backend:v1.0.0
    FRONTEND_IMAGE=ghcr.io/OWNER/REPOSITORY-frontend:v1.0.0

Then run:

    docker compose --env-file .env.docker pull
    docker compose --env-file .env.docker up -d

## GitHub pipeline

The backend quality workflow validates with MySQL and Redis. The Docker publish workflow creates multi-architecture frontend and backend images for tags such as v1.0.0.

## Development and verification

    npm run dev:backend
    npm run dev:frontend
    npm --prefix frontend run lint
    npm --prefix frontend test
    npm --prefix frontend run build
    npm --prefix backend test
    docker compose --env-file .env.docker config --quiet

Backend liveness is /api/health and dependency readiness is /api/ready.

## Security notes

- Production data is AES-256-GCM encrypted before MySQL storage.
- Production sessions default to Secure, HttpOnly, and SameSite=Strict.
- SESSION_COOKIE_SECURE=false is only for local HTTP evaluation.
- Demo/default credentials are disabled in production.
- Never commit .env.docker, OAuth secrets, encryption keys, passwords, or database volumes.
