/**
 * Upsert country pricing rows only (India INR + other markets).
 * Use when full `npm run prisma:seed` is slow or fails mid-run.
 *
 * Usage: npm run seed:country-pricing
 */
import { PrismaClient } from '@prisma/client';
import { COUNTRY_PRICING_SEEDS } from '../src/config/pricing.config';

async function main() {
  const prisma = new PrismaClient();

  try {
    for (const seed of COUNTRY_PRICING_SEEDS) {
      await prisma.countryPricing.upsert({
        where: {
          countryCode_userType_planId: {
            countryCode: seed.countryCode,
            userType: seed.userType,
            planId: seed.planId,
          },
        },
        create: {
          countryCode: seed.countryCode,
          userType: seed.userType,
          planId: seed.planId,
          currency: seed.currency,
          amount: seed.amount,
          aiCredits: seed.aiCredits,
          features: seed.features,
          isActive: true,
        },
        update: {
          currency: seed.currency,
          amount: seed.amount,
          aiCredits: seed.aiCredits,
          features: seed.features,
          isActive: true,
        },
      });
    }

    const india = await prisma.countryPricing.findMany({
      where: { countryCode: 'IN' },
      select: { planId: true, currency: true, amount: true, aiCredits: true },
      orderBy: { planId: 'asc' },
    });

    console.log(`✅ Upserted ${COUNTRY_PRICING_SEEDS.length} country pricing rows.`);
    console.log('\nIndia (IN) plans:');
    for (const row of india) {
      console.log(
        `  ${row.planId}: ${row.currency} ${row.amount} → ${row.aiCredits} credits/mo`,
      );
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
