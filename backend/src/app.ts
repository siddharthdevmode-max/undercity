import express from 'express';
import cors from 'cors';
import sequelize from './config/database';
import authRoutes from './routes/authRoutes';
import { config } from './config';

const app = express();

app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Initialize database and start server
const start = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connected');

    await sequelize.sync({ alter: process.env.NODE_ENV === 'development' });
    console.log('✅ Models synced');

    app.listen(config.port, () => {
      console.log(`🚀 Backend running on http://localhost:${config.port}`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

start();

export default app;
