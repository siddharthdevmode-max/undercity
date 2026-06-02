# 🚀 Undercity Deployment Guide

## Local Development

### Option A — Docker (Recommended)
Spin up postgres + redis with one command:

    docker compose up -d

Then run backend + frontend manually for hot reload:

    # Terminal 1
    cd backend && npm run dev

    # Terminal 2
    cd frontend && npm run dev

### Option B — Everything in Docker

    docker compose --profile full up

### Stop everything

    docker compose down          # stop containers
    docker compose down -v       # stop + delete data

---

## Production Deployment

### Frontend → Cloudflare Pages

1. Push to GitHub
2. Cloudflare Pages → Connect to git repo
3. Build settings:
   - Framework: Vite
   - Build command: cd frontend && npm install && npm run build
   - Build output: frontend/dist
   - Root directory: /
4. Environment variables (add in CF dashboard):
   - VITE_API_URL → your backend URL
   - VITE_FIREBASE_API_KEY
   - VITE_FIREBASE_AUTH_DOMAIN
   - VITE_FIREBASE_PROJECT_ID
   - VITE_FIREBASE_APP_ID

### Backend → Render

1. Push to GitHub
2. Render → New Web Service → Connect repo
3. Settings:
   - Root directory: backend
   - Runtime: Docker
   - Dockerfile path: ./Dockerfile
4. Add PostgreSQL + Redis instances on Render
5. Environment variables (add in Render dashboard):
   - Copy from backend/.env.example
   - Set DATABASE_URL to Render postgres connection string
   - Set REDIS_HOST and REDIS_PORT to Render redis values
   - Generate fresh JWT_SECRET:
     node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
   - Set NODE_ENV=production
6. Add firebase-service-account.json as Render secret file

### Database Migrations
Run on first deploy and after every migration change:

    cd backend && npm run migrate

---

## CI/CD

GitHub Actions runs automatically on push to main:
- TypeScript check
- Tests
- Frontend build

See .github/workflows/ci.yml

---

## Secret Rotation Checklist

When rotating secrets before launch:
- [ ] Generate new JWT_SECRET
- [ ] Rotate Firebase API key in Firebase Console
- [ ] Regenerate Firebase service account JSON
- [ ] Update ADMIN_UIDS to production UIDs
- [ ] Update ALLOWED_ORIGINS with production domain only
- [ ] Change POSTGRES_PASSWORD in production
- [ ] Set Redis password in production (REDIS_PASSWORD)
- [ ] Update all .env files locally and in production dashboards
