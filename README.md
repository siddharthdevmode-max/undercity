# 🏙️ Undercity — Text-Based Crime MMO

A browser-based crime MMO inspired by Torn. Build your criminal empire, commit crimes, train stats, and dominate the underground.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TypeScript, Vite |
| Backend | Node.js, Express 5, TypeScript |
| Database | PostgreSQL 16 |
| Cache | Redis 7 |
| Auth | Firebase Auth |
| Anti-Cheat | UAC 1.0 (custom) |
| Deploy | Cloudflare Pages + Render |

## Quick Start

Start postgres + redis:

    docker compose up -d

Backend (terminal 1):

    cd backend && npm install && npm run dev

Frontend (terminal 2):

    cd frontend && npm install && npm run dev

## Documentation

- Deployment Guide: ./DEPLOYMENT.md
- API Docs: http://localhost:5000/api/docs
- Architecture Plan: ./docs/PLAN.md

## Project Structure

    undercity/
    backend/          # Express API
      src/
        controllers/
        services/
        models/
        middleware/
        routes/
        utils/
      migrations/
    frontend/         # React app
      src/
        components/
        pages/
        hooks/
        styles/
    docs/

## License

ISC © Challenger_69
