# Undercity: Torn-Style Clone Implementation Plan

**Project Name**: Undercity  
**Based On**: Torn.com (Text-based City RPG)  
**Stack**: Node.js + React + PostgreSQL  
**Target**: Full-featured city management and PvP game  
**Status**: Planning Phase

---

## 1. High-Level Architecture

### Frontend (React + TypeScript)
```
undercity/frontend/
├── src/
│   ├── pages/
│   │   ├── Landing.tsx
│   │   ├── Home.tsx
│   │   ├── City.tsx
│   │   ├── Crimes.tsx
│   │   ├── Job.tsx
│   │   ├── Gym.tsx
│   │   ├── Education.tsx
│   │   ├── Hospital.tsx
│   │   ├── Jail.tsx
│   │   ├── Casino.tsx
│   │   ├── Properties.tsx
│   │   ├── Faction.tsx
│   │   ├── Newspaper.tsx
│   │   ├── Calendar.tsx
│   │   ├── Profile.tsx
│   │   ├── AttackLog.tsx
│   │   ├── Settings.tsx
│   │   └── HallOfFame.tsx
│   ├── components/
│   │   ├── Layout/
│   │   │   ├── Shell.tsx (main shell with sidebar)
│   │   │   ├── Header.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   └── ResourceBar.tsx
│   │   ├── Forms/
│   │   ├── Cards/
│   │   ├── Modals/
│   │   └── Common/
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   ├── usePlayer.ts
│   │   ├── useActions.ts
│   │   ├── useTimers.ts (energy regen, etc.)
│   │   └── useNotifications.ts
│   ├── services/
│   │   ├── api.ts (API client)
│   │   ├── auth.ts
│   │   └── game.ts
│   ├── store/ (Redux or Zustand)
│   ├── types/
│   │   ├── user.ts
│   │   ├── game.ts
│   │   ├── actions.ts
│   │   └── index.ts
│   ├── App.tsx
│   └── index.tsx
├── public/
└── package.json
```

### Backend (Node.js + Express)
```
undercity/backend/
├── src/
│   ├── routes/
│   │   ├── auth.ts
│   │   ├── user.ts
│   │   ├── actions.ts (crimes, jobs, gym, etc.)
│   │   ├── city.ts
│   │   ├── properties.ts
│   │   ├── faction.ts
│   │   ├── pvp.ts
│   │   ├── market.ts
│   │   └── news.ts
│   ├── controllers/
│   │   ├── authController.ts
│   │   ├── userController.ts
│   │   ├── actionController.ts
│   │   └── ...
│   ├── models/
│   │   ├── User.ts
│   │   ├── Action.ts
│   │   ├── Crime.ts
│   │   ├── Job.ts
│   │   ├── Property.ts
│   │   ├── Faction.ts
│   │   └── ...
│   ├── services/
│   │   ├── userService.ts
│   │   ├── actionService.ts
│   │   ├── economyService.ts
│   │   └── timerService.ts
│   ├── middleware/
│   │   ├── auth.ts
│   │   ├── errorHandler.ts
│   │   └── validators.ts
│   ├── utils/
│   │   ├── helpers.ts
│   │   └── constants.ts
│   ├── db/
│   │   ├── connection.ts
│   │   └── migrations/ (database schema versions)
│   ├── config/
│   │   └── index.ts
│   └── app.ts
├── .env.example
├── package.json
└── tsconfig.json
```

---

## 2. Database Schema (PostgreSQL)

### Core Tables

#### Users
```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  
  -- Resources
  money BIGINT DEFAULT 750,
  level INT DEFAULT 1,
  experience INT DEFAULT 0,
  points INT DEFAULT 0,
  
  -- Stats
  strength INT DEFAULT 10,
  defense INT DEFAULT 10,
  speed INT DEFAULT 10,
  dexterity INT DEFAULT 10,
  
  -- Bars
  energy INT DEFAULT 100,
  max_energy INT DEFAULT 100,
  nerve INT DEFAULT 15,
  max_nerve INT DEFAULT 15,
  life INT DEFAULT 100,
  max_life INT DEFAULT 100,
  happiness INT DEFAULT 100,
  
  -- Status
  status VARCHAR(20) DEFAULT 'okay', -- okay, hospital, jail, traveling
  last_action TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### Cities & Locations
```sql
CREATE TABLE city_locations (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  area VARCHAR(50), -- West Side, Red-Light, etc.
  location_type VARCHAR(50), -- gym, shop, crime_spot, etc.
  data JSONB -- flexible for location-specific data
);
```

#### Crimes
```sql
CREATE TABLE crimes (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  difficulty INT,
  energy_cost INT,
  base_reward INT,
  success_chance INT DEFAULT 70,
  requirements JSONB -- stat requirements, level, etc.
);
```

#### Jobs
```sql
CREATE TABLE jobs (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  daily_income INT,
  required_stats JSONB,
  benefits JSONB
);
```

#### User Actions Log
```sql
CREATE TABLE action_logs (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id),
  action_type VARCHAR(50), -- crime, job, gym, attack, etc.
  action_id INT,
  result VARCHAR(20), -- success, fail, partial
  reward INT,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### Properties
```sql
CREATE TABLE properties (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id),
  property_type VARCHAR(50), -- shack, apartment, house, etc.
  name VARCHAR(100),
  cost INT,
  upkeep_daily INT,
  upgrades JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### Factions
```sql
CREATE TABLE factions (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  founder_id INT REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  description TEXT,
  logo_url VARCHAR(255),
  bank BIGINT DEFAULT 0
);
```

#### Faction Members
```sql
CREATE TABLE faction_members (
  id SERIAL PRIMARY KEY,
  faction_id INT REFERENCES factions(id),
  user_id INT REFERENCES users(id),
  rank VARCHAR(50), -- member, officer, leader
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## 3. API Routes & Endpoints

### Authentication
```
POST /api/auth/register
POST /api/auth/login
POST /api/auth/logout
GET  /api/auth/me
```

### User & Profile
```
GET  /api/users/:id (public profile)
GET  /api/users/:id/stats
GET  /api/users/:id/inventory
POST /api/users/:id/settings
```

### Actions (Gameplay)
```
POST /api/actions/crime/:crimeId
POST /api/actions/job/:jobId (work)
POST /api/actions/gym/train/:statName
POST /api/actions/education/:courseId
```

### City & Locations
```
GET  /api/city/locations
GET  /api/city/map
GET  /api/city/locations/:id
```

### Properties
```
GET  /api/properties (user's properties)
POST /api/properties/buy
POST /api/properties/:id/upgrade
```

### Factions
```
GET  /api/factions
POST /api/factions/create
GET  /api/factions/:id
POST /api/factions/:id/join
```

### PvP / Combat
```
POST /api/pvp/attack/:targetId
GET  /api/pvp/attack-log
```

### News & Market
```
GET  /api/news
POST /api/market/list-item
GET  /api/market/listings
```

---

## 4. Game Mechanics

### Energy System
- Regenerates over time (configurable, e.g., 1 energy per 5 minutes)
- Consumed by:
  - Gym training (5 per train)
  - Crimes (10-25 depending on crime)
  - Job work (20 per work shift)
- Max energy = 100 initially, increases with level

### Nerve System
- Daily cap: 15
- Regenerates once per day at midnight
- Used for attacking other players
- Can be increased through training

### Money & Economy
- Earned via:
  - Crimes (variable, some risky)
  - Job income (steady, level-based)
  - Property rent (passive)
  - Market sales
- Spent on:
  - Property upkeep
  - Education courses
  - Casino gambling
  - Items/weapons

### Leveling & Experience
- Gain XP from crimes, jobs, training, PvP
- Level unlocks new areas, crimes, jobs
- Stat growth tied to training and leveling

### Action Cooldowns
- Some crimes have cooldowns (e.g., can only mug once per hour)
- Job can work once per day
- Education courses take days/weeks to complete

---

## 5. Development Phases

### Phase 1: MVP (Weeks 1-3)
**Goal**: Core gameplay loop working

#### Frontend
- Landing page + auth flow
- Main shell layout with sidebar
- Home dashboard (stats, profile)
- City location list
- Crime action page (select crime, execute, show result)
- Job page (show income, work button)
- Gym page (train stats)
- Basic mission/tutorial flow

#### Backend
- User registration/login with JWT
- User stats model
- Crime system (execute, rewards, success/fail)
- Job system (work, daily income)
- Gym training (stat increases)
- Energy/nerve regeneration
- Action logging

#### Database
- Users table
- Crimes, Jobs tables
- ActionLogs table
- Basic city locations

### Phase 2: Social & Economy (Weeks 4-6)
**Goal**: Properties, factions, PvP, market

#### Frontend
- Properties page (buy, manage, upgrades)
- Faction creation/browsing
- Profile pages (public view)
- Attack log + PvP interface
- Market/trading interface
- Newspaper (news feed, classifieds)

#### Backend
- Properties system (ownership, upkeep, upgrades)
- Faction creation, membership, hierarchy
- PvP attacks (energy cost, outcome calculation)
- Market listings and trading
- News feed generation
- Profile endpoints

#### Database
- Properties table
- Factions + FactionMembers
- Market listings
- PvP records

### Phase 3: Advanced Systems (Weeks 7-10)
**Goal**: Depth, progression, events

#### Frontend
- Education courses with progress
- Hospital/recovery system
- Jail/incarceration system
- Casino mini-games
- Calendar & events
- Hall of Fame leaderboards
- Settings page

#### Backend
- Education progression tracking
- Hospital/recovery mechanics
- Jail sentences and bail
- Casino games logic
- Event scheduling
- Leaderboard calculations
- User settings persistence

#### Database
- Education/skills table
- Hospital records
- Jail records
- Events table
- User preferences

---

## 6. Key Implementation Details

### Energy Regeneration
- Client-side timer UI (shows time until next energy)
- Server validates on each action
- Calculated as: `current_energy = Math.min(max_energy, energy + (timeElapsed / 5min))`

### Crime Success
- Rolled based on stat bonuses vs. crime difficulty
- Formula: `successChance = (playerStats / crimeRequirements) * baseChance`
- Reward varies: can gain extra money or fail

### Mission Tutorial
- Locked/unlocked states for missions
- Complete conditions tied to achievements (first crime, reach level 2, etc.)
- Reward items/cash on completion

### Faction Warfare
- Declare war on another faction
- Track kills/assists per member
- Territory/respect points

---

## 7. Timeline Estimate

**Total: 10-12 weeks for full MVP + Phase 2**

- Week 1-2: Backend auth + core models, Frontend shell
- Week 3: Crime + Job + Gym systems fully working
- Week 4: Properties, factions, PvP basics
- Week 5-6: Market, newspaper, profile pages
- Week 7-8: Education, hospital, jail, casino
- Week 9-10: Leaderboards, calendar, polishing
- Week 11-12: Testing, deployment prep, bug fixes

---

## 8. Tech Stack Summary

### Frontend
- **React 18** with TypeScript
- **Redux Toolkit** or **Zustand** for state
- **React Router v6** for routing
- **Axios** for HTTP
- **Tailwind CSS** or **Styled-components** for styling
- **Socket.io-client** for real-time updates (optional, Phase 2+)

### Backend
- **Node.js** 18+
- **Express** for HTTP server
- **TypeScript** for type safety
- **PostgreSQL** 14+ for database
- **Sequelize** or **TypeORM** for ORM
- **JWT** for authentication
- **Bcrypt** for password hashing
- **Socket.io** for real-time (optional)

### DevOps
- **Docker** for containerization (optional, Phase 2+)
- **GitHub** for version control
- **GitHub Actions** for CI/CD

---

## 9. First Steps

1. **Setup backend project**
   - Initialize Node + Express + TypeScript
   - Create PostgreSQL database
   - Setup auth (register/login/JWT)
   - Create user model and migrations

2. **Setup frontend project**
   - Initialize React + TypeScript + Vite/CRA
   - Create Shell layout component
   - Setup routing structure
   - Create landing page

3. **Connect auth flow**
   - Implement registration page
   - Implement login page
   - Store JWT in localStorage
   - Redirect to home after login

4. **Build core game loop**
   - Implement crime execution
   - Implement job work
   - Implement gym training
   - Add energy/stat display on home

5. **Real-time updates**
   - Energy regeneration timer
   - Action results feedback
   - Activity log

---

## 10. Success Criteria

- ✅ Users can register, login, and maintain persistent state
- ✅ Energy system works and regenerates
- ✅ Crime/job/gym actions execute and reward players
- ✅ Stats visibly progress over time
- ✅ Missions unlock as players progress
- ✅ Properties can be purchased and managed
- ✅ Factions can be created and joined
- ✅ PvP attacks work and are logged
- ✅ Market trading functions
- ✅ Leaderboards update in real-time

---

**Next Step**: Initialize `undercity/backend` and `undercity/frontend` with this structure and start Phase 1 development.
