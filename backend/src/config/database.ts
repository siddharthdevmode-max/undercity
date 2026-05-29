import path from 'path';
import dotenv from 'dotenv';
import { Sequelize } from 'sequelize';

dotenv.config();

const databaseUrl = process.env.DATABASE_URL;
const isSqlite = databaseUrl?.startsWith('sqlite:');

const sequelize = isSqlite
  ? new Sequelize({
      dialect: 'sqlite',
      storage: path.resolve(__dirname, '../../database.sqlite'),
      logging: process.env.NODE_ENV === 'development' ? console.log : false,
    })
  : new Sequelize(databaseUrl || 'postgresql://postgres:postgres@localhost:5432/undercity', {
      dialect: 'postgres',
      logging: process.env.NODE_ENV === 'development' ? console.log : false,
    });

export default sequelize;
