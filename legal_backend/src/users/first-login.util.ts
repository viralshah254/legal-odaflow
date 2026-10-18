import { PrismaService } from '@/prisma/prisma.service';

/** Records the user's first authenticated session (used for intro-offer window). */
export async function ensureFirstLoginRecorded(
  prisma: PrismaService,
  userId: string,
): Promise<Date | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { firstLoginAt: true },
  });
  if (!user) return null;
  if (user.firstLoginAt) return user.firstLoginAt;

  const now = new Date();
  await prisma.user.updateMany({
    where: { id: userId, firstLoginAt: null },
    data: { firstLoginAt: now },
  });
  return now;
}
