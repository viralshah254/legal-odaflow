/**
 * Upserts the platform superadmin from SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD.
 * Set SEED_ADMIN_RESET_PASSWORD=true to reset the password and force change on next login.
 *
 * Usage: npm run seed:admin
 */
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

async function main() {
  const prisma = new PrismaClient();
  const adminEmail = (process.env.SEED_ADMIN_EMAIL ?? 'admin@odaflow.com').toLowerCase();
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;

  if (!adminPassword?.trim()) {
    throw new Error('SEED_ADMIN_PASSWORD is required');
  }

  const resetAdminPassword = process.env.SEED_ADMIN_RESET_PASSWORD === 'true';
  const passwordHash = await bcrypt.hash(adminPassword, 12);

  const existing = await prisma.user.findUnique({
    where: { email: adminEmail },
    select: { id: true },
  });

  if (!existing) {
    const user = await prisma.user.create({
      data: {
        email: adminEmail,
        name: 'Platform Admin',
        passwordHash,
        userType: 'SUPER_ADMIN',
        countryCode: 'US',
        isActive: true,
        mustChangePassword: true,
      },
      select: { id: true, email: true, userType: true, mustChangePassword: true },
    });
    console.log('Created superadmin:', user);
  } else {
    const user = await prisma.user.update({
      where: { email: adminEmail },
      data: {
        name: 'Platform Admin',
        userType: 'SUPER_ADMIN',
        isActive: true,
        ...(resetAdminPassword
          ? { passwordHash, mustChangePassword: true }
          : {}),
      },
      select: { id: true, email: true, userType: true, mustChangePassword: true },
    });
    console.log(
      resetAdminPassword
        ? 'Reset superadmin password (must change on next login):'
        : 'Updated superadmin profile (password unchanged):',
      user,
    );
  }

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
