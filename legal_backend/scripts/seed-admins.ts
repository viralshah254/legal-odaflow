/**
 * Upserts all platform super admins defined below.
 * Passwords are read from environment variables — never committed.
 *
 * Usage: npm run seed:admins
 *
 * Required env vars:
 *   ADMIN_GJAIN_PASSWORD   — password for g.jain@okaylegal.ai
 *   ADMIN_GARIMA_PASSWORD  — password for garima@okaylegal.ai (when known)
 */
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

interface AdminSeed {
  email: string;
  name: string;
  adminProfile: string;
  passwordEnvKey: string;
  countryCode: string;
  mustChangePassword: boolean;
}

const ADMINS: AdminSeed[] = [
  {
    email: 'g.jain@okaylegal.ai',
    name: 'Co-CEO / CTO',
    adminProfile: 'CTO',
    passwordEnvKey: 'ADMIN_GJAIN_PASSWORD',
    countryCode: 'IN',
    mustChangePassword: false,
  },
  // Add Garima when email confirmed:
  // {
  //   email: 'garima@okaylegal.ai',
  //   name: 'Garima — Co-CEO / CFO / CMO',
  //   adminProfile: 'CFO_CMO',
  //   passwordEnvKey: 'ADMIN_GARIMA_PASSWORD',
  //   countryCode: 'IN',
  //   mustChangePassword: false,
  // },
];

async function main() {
  const prisma = new PrismaClient();

  for (const admin of ADMINS) {
    const password = process.env[admin.passwordEnvKey];
    if (!password?.trim()) {
      console.warn(`Skipping ${admin.email}: ${admin.passwordEnvKey} not set`);
      continue;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const existing = await prisma.user.findUnique({
      where: { email: admin.email },
      select: { id: true },
    });

    if (!existing) {
      const user = await prisma.user.create({
        data: {
          email: admin.email,
          name: admin.name,
          passwordHash,
          userType: 'SUPER_ADMIN',
          adminProfile: admin.adminProfile,
          countryCode: admin.countryCode,
          isActive: true,
          mustChangePassword: admin.mustChangePassword,
        },
        select: { id: true, email: true, userType: true, adminProfile: true },
      });
      console.log('Created admin:', user);
    } else {
      const user = await prisma.user.update({
        where: { email: admin.email },
        data: {
          name: admin.name,
          userType: 'SUPER_ADMIN',
          adminProfile: admin.adminProfile,
          isActive: true,
          mustChangePassword: admin.mustChangePassword,
          passwordHash,
        },
        select: { id: true, email: true, userType: true, adminProfile: true },
      });
      console.log('Updated admin:', user);
    }
  }

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
