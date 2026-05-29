import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: process.env.PORT || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  databaseUrl: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/undercity',
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-key',
  jwtExpiry: process.env.JWT_EXPIRY || '7d',
};
