import express, { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();
const router = Router();
const app = express();
const prisma = new PrismaClient();
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET!;

// ================== Zod Schemas ==================
const signupSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters long"),
  email: z.string().email("Invalid email format"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  username: z.string().min(3, "Username must be at least 3 characters"),
});

const signinSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

// ================== Routes ==================
router.post('/signup', async (req, res) => {
  try {
    // validate with Zod
    const parsedData = signupSchema.safeParse(req.body);
    if (!parsedData.success) {
      return res.status(400).json({
        error: parsedData.error.issues.map((e: { message: any; }) => e.message),
      });
    }
    const { name, email, password, username } = parsedData.data;

    // check if user already exists
    const existing = await prisma.user.findFirst({
      where: { OR: [{ email }, { username }] }
    });

    if (existing) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: { name, email, username, password: hashedPassword }
    });

    const { password: _, ...userSafe } = user;
    return res.json({ message: 'User registered successfully', user: userSafe });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

router.post('/signin', async (req, res) => {
  try {
    // validate with Zod
    const parsedData = signinSchema.safeParse(req.body);
    if (!parsedData.success) {
      return res.status(400).json({
        error: parsedData.error.issues.map((e: { message: any; }) => e.message),
      });
    }
    const { username, password } = parsedData.data;

    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '1h' });

    return res.json({ message: 'Signin successful', token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

export default router;
