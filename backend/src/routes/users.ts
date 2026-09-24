import { Router } from 'express';
import { prisma } from '../prisma';
import { AuthedRequest, requireAuth } from '../auth/jwt';

const router = Router();

router.get('/me/stats', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const [totals, recent] = await Promise.all([
      prisma.call.aggregate({
        where: { userId: req.userId },
        _count: true,
        _sum: { durationSec: true },
        _max: { durationSec: true },
      }),
      prisma.call.findMany({
        where: { userId: req.userId },
        orderBy: { startedAt: 'desc' },
        take: 8,
        select: { id: true, partnerName: true, startedAt: true, durationSec: true },
      }),
    ]);

    return res.json({
      totalCalls: totals._count,
      totalSeconds: totals._sum.durationSec ?? 0,
      longestSeconds: totals._max.durationSec ?? 0,
      recent,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

export default router;
