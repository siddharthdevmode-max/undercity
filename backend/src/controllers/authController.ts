import { Request, Response } from 'express';
import bcryptjs from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import User from '../models/User';
import { config } from '../config';

export const register = async (req: Request, res: Response) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: 'Email already exists' });
    }

    const existingUsername = await User.findOne({ where: { username } });
    if (existingUsername) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    const hashedPassword = await bcryptjs.hash(password, 10);

    const user = await User.create({
      username,
      email,
      password_hash: hashedPassword,
    });

    const token = jwt.sign(
      { id: user.id, email: user.email },
      config.jwtSecret as jwt.Secret,
      { expiresIn: config.jwtExpiry } as jwt.SignOptions,
    );

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Registration failed' });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Missing email or password' });
    }

    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isPasswordValid = await bcryptjs.compare(password, user.password_hash);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email },
      config.jwtSecret as jwt.Secret,
      { expiresIn: config.jwtExpiry } as jwt.SignOptions,
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        level: user.level,
        money: user.money,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Login failed' });
  }
};

export const getMe = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const user = await User.findByPk(userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      id: user.id,
      username: user.username,
      email: user.email,
      level: user.level,
      money: user.money,
      experience: user.experience,
      points: user.points,
      strength: user.strength,
      defense: user.defense,
      speed: user.speed,
      dexterity: user.dexterity,
      energy: user.energy,
      max_energy: user.max_energy,
      nerve: user.nerve,
      max_nerve: user.max_nerve,
      life: user.life,
      max_life: user.max_life,
      happiness: user.happiness,
      status: user.status,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
};
