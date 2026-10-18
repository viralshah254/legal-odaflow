/// <reference types="node" />
import { PrismaClient } from '@prisma/client';
import { AI_CREDIT_RATE_SEEDS } from '../src/ai-credits/ai-credit-rate.seed';

const prisma = new PrismaClient();

async function main() {
  let seeded = 0;
  for (const rate of AI_CREDIT_RATE_SEEDS) {
    await prisma.aICreditRate.upsert({
      where: { id: rate.id },
      create: {
        id: rate.id,
        taskType: rate.taskType,
        userSegment: rate.userSegment,
        baseCredits: rate.baseCredits,
        minCredits: rate.minCredits,
        maxCredits: rate.maxCredits,
        modelTier: rate.modelTier,
        markupMultiplier: rate.markupMultiplier,
        enabled: rate.enabled,
      },
      update: {
        baseCredits: rate.baseCredits,
        minCredits: rate.minCredits,
        maxCredits: rate.maxCredits,
        modelTier: rate.modelTier,
        enabled: rate.enabled,
        // markupMultiplier intentionally not overwritten — admin may have tuned it
      },
    });
    seeded++;
  }
  console.log(`✓ Seeded ${seeded} AI credit rates (${AI_CREDIT_RATE_SEEDS.length / 5} task types × 5 segments)`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
