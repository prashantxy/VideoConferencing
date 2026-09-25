import { Router } from 'express';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import { prisma } from '../prisma';
import { signinAccountLimit, signinIpLimit, signupLimit } from './rateLimits';
import { AUTH_COOKIE, AuthedRequest, clearAuthCookie, readCookie, requireAuth, setAuthCookie, signSocketTicket, verifySession } from './jwt';

const router = Router();

const signupSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters long").max(50),
  email: z.string().trim().toLowerCase().email("Invalid email format"),
  password: z.string().min(8, "Password must be at least 8 characters").max(128),
  username: z
    .string()
    .trim()
    .min(3, "Username must be at least 3 characters")
    .max(24, "Username must be at most 24 characters")
    .regex(/^[a-zA-Z0-9_.]+$/, "Username can only contain letters, numbers, _ and ."),
});

// `username` may also be an email address.
const signinSchema = z.object({
  username: z.string().trim().min(3, "Username must be at least 3 characters").max(254),
  // Older accounts may have 6-7 character passwords, so sign-in only needs one.
  password: z.string().min(1, "Password is required").max(128),
});

const publicUser = { id: true, name: true, email: true, username: true, createdAt: true } as const;

router.post('/signup', signupLimit, async (req, res) => {
  try {
    const parsedData = signupSchema.safeParse(req.body);
    if (!parsedData.success) {
      return res.status(400).json({
        error: parsedData.error.issues.map((e) => e.message),
      });
    }
    const { name, email, password, username } = parsedData.data;

    const existing = await prisma.user.findFirst({
      where: { OR: [{ email }, { username }] }
    });

    if (existing) {
      const field = existing.email === email ? 'email' : 'username';
      return res.status(409).json({ error: `An account with that ${field} already exists` });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: { name, email, username, password: hashedPassword },
      select: { ...publicUser, tokenVersion: true },
    });

    setAuthCookie(res, user);
    const { tokenVersion: _, ...userSafe } = user;
    return res.status(201).json({ message: 'User registered successfully', user: userSafe });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

router.post('/signin', signinIpLimit, signinAccountLimit, async (req, res) => {
  try {
    const parsedData = signinSchema.safeParse(req.body);
    if (!parsedData.success) {
      return res.status(400).json({
        error: parsedData.error.issues.map((e) => e.message),
      });
    }
    const { username, password } = parsedData.data;

    const user = await prisma.user.findUnique({
      where: username.includes('@') ? { email: username.toLowerCase() } : { username },
    });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    // Google-only accounts have no password.
    const isValid = user.password !== null && (await bcrypt.compare(password, user.password));
    if (!isValid) return res.status(401).json({ error: 'Invalid credentials' });

    const { password: _, googleId: __, tokenVersion: ___, ...userSafe } = user;
    setAuthCookie(res, user);
    return res.json({ message: 'Signin successful', user: userSafe });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

router.get('/me', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId }, select: publicUser });
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    return res.json({ user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

// Signs out everywhere: bumping tokenVersion invalidates every cookie issued so far,
// including one that was copied off this device.
router.post('/logout', async (req, res) => {
  try {
    const userId = await verifySession(readCookie(req.headers.cookie, AUTH_COOKIE));
    if (userId) await prisma.user.update({ where: { id: userId }, data: { tokenVersion: { increment: 1 } } });
  } catch (err) {
    console.error(err);
  }
  clearAuthCookie(res);
  res.json({ message: 'Signed out' });
});

// Short-lived token the Room page hands to the Socket.IO handshake.
router.get('/socket-ticket', requireAuth, (req: AuthedRequest, res) => {
  res.json({ ticket: signSocketTicket(req.userId!) });
});

export default router;
