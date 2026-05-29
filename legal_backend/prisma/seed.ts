import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { INTERNAL_AGENTS } from '../src/agents/agent.registry';
import { COUNTRY_COMPLIANCE_POLICY_SEEDS } from '../src/country-compliance/country-compliance.seed';
import { LEGAL_AUTHORITY_SEEDS } from '../src/config/legal-authority.seed';
import { COUNTRY_PRICING_SEEDS } from '../src/config/pricing.config';
import { LEGAL_SOURCE_CONNECTOR_SEEDS } from '../src/legal-sources/legal-source.seed';

const prisma = new PrismaClient();

async function upsertDemoTenant(input: {
  name: string;
  countryCode: string;
  currency: string;
  lawyers: Array<{ email: string; name: string; role: string }>;
}) {
  const tenant = await prisma.tenant.upsert({
    where: { id: `seed-${input.countryCode.toLowerCase()}` },
    create: {
      id: `seed-${input.countryCode.toLowerCase()}`,
      name: input.name,
      type: 'LAW_FIRM',
      primaryCountry: input.countryCode,
      defaultCurrency: input.currency,
      billingPlan: 'PRO',
      dataRegion: 'regional',
    },
    update: {
      name: input.name,
      defaultCurrency: input.currency,
      billingPlan: 'PRO',
      isActive: true,
    },
  });

  for (const lawyer of input.lawyers) {
    const passwordHash = await bcrypt.hash('Lawyer123!ChangeMe', 12);
    const user = await prisma.user.upsert({
      where: { email: lawyer.email.toLowerCase() },
      create: {
        email: lawyer.email.toLowerCase(),
        name: lawyer.name,
        passwordHash,
        userType: 'LAWYER',
        countryCode: input.countryCode,
        isActive: true,
      },
      update: {
        name: lawyer.name,
        passwordHash,
        userType: 'LAWYER',
        countryCode: input.countryCode,
        isActive: true,
      },
    });

    await prisma.tenantUser.upsert({
      where: {
        tenantId_userId: {
          tenantId: tenant.id,
          userId: user.id,
        },
      },
      create: {
        tenantId: tenant.id,
        userId: user.id,
        role: lawyer.role,
      },
      update: {
        role: lawyer.role,
        status: 'ACTIVE',
      },
    });
  }

  const client = await prisma.client.upsert({
    where: { id: `seed-client-${input.countryCode.toLowerCase()}` },
    create: {
      id: `seed-client-${input.countryCode.toLowerCase()}`,
      tenantId: tenant.id,
      name: `${input.countryCode} Demo Client`,
      email: `client-${input.countryCode.toLowerCase()}@example.com`,
      type: 'INDIVIDUAL',
      countryCode: input.countryCode,
    },
    update: {
      name: `${input.countryCode} Demo Client`,
      email: `client-${input.countryCode.toLowerCase()}@example.com`,
      countryCode: input.countryCode,
    },
  });

  await prisma.matter.upsert({
    where: { id: `seed-matter-${input.countryCode.toLowerCase()}` },
    create: {
      id: `seed-matter-${input.countryCode.toLowerCase()}`,
      tenantId: tenant.id,
      clientId: client.id,
      title: `${input.countryCode} Employment Dispute`,
      countryCode: input.countryCode,
      jurisdiction:
        input.countryCode === 'US'
          ? 'California'
          : input.countryCode === 'KE'
            ? 'Nairobi'
            : 'Maharashtra',
      practiceArea: 'Employment',
      matterType: 'LITIGATION',
      status: 'OPEN',
    },
    update: {
      title: `${input.countryCode} Employment Dispute`,
      countryCode: input.countryCode,
      practiceArea: 'Employment',
      matterType: 'LITIGATION',
      status: 'OPEN',
    },
  });

  await prisma.automationRule.upsert({
    where: { id: `seed-rule-matter-created-${input.countryCode.toLowerCase()}` },
    create: {
      id: `seed-rule-matter-created-${input.countryCode.toLowerCase()}`,
      tenantId: tenant.id,
      name: 'Matter kickoff notification',
      trigger: 'matter.created',
      conditions: { matterType: 'LITIGATION' },
      actions: [
        {
          type: 'send_notification',
          title: 'Matter created: {{matterTitle}}',
          body: 'Kickoff checklist is now available.',
          userIdField: 'userId',
        },
      ],
      isEnabled: true,
    },
    update: {
      name: 'Matter kickoff notification',
      trigger: 'matter.created',
      conditions: { matterType: 'LITIGATION' },
      actions: [
        {
          type: 'send_notification',
          title: 'Matter created: {{matterTitle}}',
          body: 'Kickoff checklist is now available.',
          userIdField: 'userId',
        },
      ],
      isEnabled: true,
    },
  });

  await prisma.matterPlaybook.upsert({
    where: { id: `seed-playbook-${input.countryCode.toLowerCase()}` },
    create: {
      id: `seed-playbook-${input.countryCode.toLowerCase()}`,
      tenantId: tenant.id,
      name: 'Litigation kickoff',
      description: 'Auto-create baseline tasks for new matters',
      countryCode: input.countryCode,
      matterType: 'LITIGATION',
      practiceArea: 'Employment',
      isEnabled: true,
      taskTemplates: [
        { title: 'Run conflict check', dueInDays: 1, priority: 'HIGH' },
        { title: 'Send client intake checklist', dueInDays: 2, priority: 'MEDIUM' },
        { title: 'Draft first case strategy memo', dueInDays: 5, priority: 'HIGH' },
      ],
    },
    update: {
      name: 'Litigation kickoff',
      description: 'Auto-create baseline tasks for new matters',
      countryCode: input.countryCode,
      matterType: 'LITIGATION',
      practiceArea: 'Employment',
      isEnabled: true,
      taskTemplates: [
        { title: 'Run conflict check', dueInDays: 1, priority: 'HIGH' },
        { title: 'Send client intake checklist', dueInDays: 2, priority: 'MEDIUM' },
        { title: 'Draft first case strategy memo', dueInDays: 5, priority: 'HIGH' },
      ],
    },
  });
}

async function main() {
  for (const seed of COUNTRY_COMPLIANCE_POLICY_SEEDS) {
    await prisma.countryCompliancePolicy.upsert({
      where: { countryCode: seed.countryCode },
      create: {
        countryCode: seed.countryCode,
        countryName: seed.countryName,
        allowConsumerGuidance: seed.allowConsumerGuidance ?? true,
        allowDocumentGeneration: seed.allowDocumentGeneration ?? true,
        allowLawyerMarketplace: seed.allowLawyerMarketplace ?? true,
        requireLawyerReviewForAdvice: seed.requireLawyerReviewForAdvice ?? true,
        requireDisclaimerOnEveryOutput: seed.requireDisclaimerOnEveryOutput ?? true,
        allowTrainingOptIn: seed.allowTrainingOptIn ?? true,
        requireExplicitTrainingConsent: seed.requireExplicitTrainingConsent ?? true,
        allowAutomatedDecisioning: seed.allowAutomatedDecisioning ?? false,
        restrictedPhrases: seed.restrictedPhrases,
        approvedProductLabels: seed.approvedProductLabels,
        dataResidencyRequired: seed.dataResidencyRequired ?? false,
        defaultDataRegion: seed.defaultDataRegion,
        notes: seed.notes,
      },
      update: {
        countryName: seed.countryName,
        allowConsumerGuidance: seed.allowConsumerGuidance ?? true,
        allowDocumentGeneration: seed.allowDocumentGeneration ?? true,
        allowLawyerMarketplace: seed.allowLawyerMarketplace ?? true,
        requireLawyerReviewForAdvice: seed.requireLawyerReviewForAdvice ?? true,
        requireDisclaimerOnEveryOutput: seed.requireDisclaimerOnEveryOutput ?? true,
        allowTrainingOptIn: seed.allowTrainingOptIn ?? true,
        requireExplicitTrainingConsent: seed.requireExplicitTrainingConsent ?? true,
        allowAutomatedDecisioning: seed.allowAutomatedDecisioning ?? false,
        restrictedPhrases: seed.restrictedPhrases,
        approvedProductLabels: seed.approvedProductLabels,
        dataResidencyRequired: seed.dataResidencyRequired ?? false,
        defaultDataRegion: seed.defaultDataRegion,
        notes: seed.notes,
      },
    });
  }

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

  for (const authority of LEGAL_AUTHORITY_SEEDS) {
    const citation = authority.citation ?? `${authority.countryCode}-SEED-${authority.title.slice(0, 12)}`;
    const existing = await prisma.legalAuthority.findFirst({
      where: {
        countryCode: authority.countryCode,
        citation,
      },
    });

    if (existing) {
      await prisma.legalAuthority.update({
        where: { id: existing.id },
        data: {
          jurisdiction: authority.jurisdiction,
          authorityType: authority.authorityType,
          title: authority.title,
          court: authority.court,
          courtLevel: authority.courtLevel,
          sourceName: authority.sourceName,
          sourceUrl: authority.sourceUrl,
          summary: authority.summary,
          holding: authority.holding,
          topics: authority.topics,
          practiceAreas: authority.practiceAreas,
        },
      });
    } else {
      await prisma.legalAuthority.create({
        data: {
          countryCode: authority.countryCode,
          jurisdiction: authority.jurisdiction,
          authorityType: authority.authorityType,
          title: authority.title,
          citation,
          court: authority.court,
          courtLevel: authority.courtLevel,
          sourceName: authority.sourceName,
          sourceUrl: authority.sourceUrl,
          summary: authority.summary,
          holding: authority.holding,
          topics: authority.topics,
          practiceAreas: authority.practiceAreas,
        },
      });
    }
  }

  for (const source of LEGAL_SOURCE_CONNECTOR_SEEDS) {
    const existing = await prisma.legalSource.findFirst({
      where: { countryCode: source.countryCode, name: source.name },
    });

    if (existing) {
      await prisma.legalSource.update({
        where: { id: existing.id },
        data: {
          sourceType: source.sourceType,
          baseUrl: source.baseUrl,
          apiAvailable: source.apiAvailable ?? false,
          scrapingAllowed: source.scrapingAllowed ?? false,
          licenseTerms: source.licenseTerms,
          refreshFrequency: source.refreshFrequency,
          enabled: true,
        },
      });
    } else {
      await prisma.legalSource.create({
        data: {
          countryCode: source.countryCode,
          name: source.name,
          sourceType: source.sourceType,
          baseUrl: source.baseUrl,
          apiAvailable: source.apiAvailable ?? false,
          scrapingAllowed: source.scrapingAllowed ?? false,
          licenseTerms: source.licenseTerms,
          refreshFrequency: source.refreshFrequency,
          enabled: true,
        },
      });
    }
  }

  for (const agent of Object.values(INTERNAL_AGENTS)) {
    await prisma.aIAgent.upsert({
      where: { key: agent.id },
      create: {
        key: agent.id,
        name: agent.name,
        description: agent.description,
        userType: 'BOTH',
        riskLevel: agent.requiresApproval ? 'HIGH' : 'MEDIUM',
        requiresApproval: agent.requiresApproval ?? false,
        enabled: true,
        allowedTools: agent.capabilities,
      },
      update: {
        name: agent.name,
        description: agent.description,
        requiresApproval: agent.requiresApproval ?? false,
        enabled: true,
        allowedTools: agent.capabilities,
      },
    });
  }

  const modelCosts = [
    {
      provider: 'openai',
      modelName: 'gpt-4.1-mini',
      modelTier: 'cheap',
      inputCostPer1M: 0.4,
      outputCostPer1M: 1.6,
    },
    {
      provider: 'openai',
      modelName: 'gpt-4.1',
      modelTier: 'premium',
      inputCostPer1M: 3.0,
      outputCostPer1M: 12.0,
    },
  ];

  for (const cost of modelCosts) {
    await prisma.aIModelCostConfig.upsert({
      where: {
        provider_modelName: {
          provider: cost.provider,
          modelName: cost.modelName,
        },
      },
      create: {
        provider: cost.provider,
        modelName: cost.modelName,
        modelTier: cost.modelTier,
        inputCostPer1M: cost.inputCostPer1M,
        outputCostPer1M: cost.outputCostPer1M,
      },
      update: {
        modelTier: cost.modelTier,
        inputCostPer1M: cost.inputCostPer1M,
        outputCostPer1M: cost.outputCostPer1M,
        isActive: true,
      },
    });
  }

  const creditPackSeeds = [
    { packId: 'pack_10', credits: 10, price: 4.99, label: '10 credits' },
    { packId: 'pack_25', credits: 25, price: 9.99, label: '25 credits' },
    { packId: 'pack_50', credits: 50, price: 17.99, label: '50 credits' },
  ];
  const packCountries = [
    { countryCode: 'US', currency: 'USD', userSegment: 'CONSUMER' },
    { countryCode: 'US', currency: 'USD', userSegment: 'LAW_FIRM' },
    { countryCode: 'IN', currency: 'INR', userSegment: 'CONSUMER' },
    { countryCode: 'IN', currency: 'INR', userSegment: 'LAW_FIRM' },
    { countryCode: 'GB', currency: 'GBP', userSegment: 'CONSUMER' },
    { countryCode: 'GB', currency: 'GBP', userSegment: 'LAW_FIRM' },
    { countryCode: 'KE', currency: 'KES', userSegment: 'CONSUMER' },
    { countryCode: 'KE', currency: 'KES', userSegment: 'LAW_FIRM' },
  ];
  const currencyMultipliers: Record<string, number> = {
    USD: 1,
    GBP: 0.79,
    INR: 83,
    KES: 129,
  };

  for (const country of packCountries) {
    const multiplier = currencyMultipliers[country.currency] ?? 1;
    for (const pack of creditPackSeeds) {
      await prisma.creditPack.upsert({
        where: {
          packId_countryCode_userSegment: {
            packId: pack.packId,
            countryCode: country.countryCode,
            userSegment: country.userSegment,
          },
        },
        create: {
          packId: pack.packId,
          countryCode: country.countryCode,
          currency: country.currency,
          credits: pack.credits,
          price: Number((pack.price * multiplier).toFixed(2)),
          userSegment: country.userSegment,
          label: pack.label,
          enabled: true,
        },
        update: {
          credits: pack.credits,
          price: Number((pack.price * multiplier).toFixed(2)),
          label: pack.label,
          enabled: true,
        },
      });
    }
  }

  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? 'admin@odaflow.com';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? 'Admin123!ChangeMe';
  const passwordHash = await bcrypt.hash(adminPassword, 12);

  await prisma.user.upsert({
    where: { email: adminEmail.toLowerCase() },
    create: {
      email: adminEmail.toLowerCase(),
      name: 'Platform Admin',
      passwordHash,
      userType: 'SUPER_ADMIN',
      countryCode: 'US',
      isActive: true,
    },
    update: {
      name: 'Platform Admin',
      passwordHash,
      userType: 'SUPER_ADMIN',
      isActive: true,
    },
  });

  await upsertDemoTenant({
    name: 'OdaFlow Legal Kenya',
    countryCode: 'KE',
    currency: 'KES',
    lawyers: [
      { email: 'partner-ke@odaflow.com', name: 'Amina Mwangi', role: 'PARTNER_ADMIN' },
      { email: 'associate-ke@odaflow.com', name: 'David Otieno', role: 'ASSOCIATE' },
    ],
  });
  await upsertDemoTenant({
    name: 'OdaFlow Legal US',
    countryCode: 'US',
    currency: 'USD',
    lawyers: [
      { email: 'partner-us@odaflow.com', name: 'Sarah Reynolds', role: 'PARTNER_ADMIN' },
      { email: 'associate-us@odaflow.com', name: 'Maya Chen', role: 'ASSOCIATE' },
    ],
  });
  await upsertDemoTenant({
    name: 'OdaFlow Legal India',
    countryCode: 'IN',
    currency: 'INR',
    lawyers: [
      { email: 'partner-in@odaflow.com', name: 'Arjun Mehta', role: 'PARTNER_ADMIN' },
      { email: 'associate-in@odaflow.com', name: 'Nisha Rao', role: 'ASSOCIATE' },
    ],
  });

  console.log(`Seeded ${COUNTRY_COMPLIANCE_POLICY_SEEDS.length} country compliance policies`);
  console.log(`Seeded ${COUNTRY_PRICING_SEEDS.length} country pricing rows`);
  console.log(`Seeded ${LEGAL_AUTHORITY_SEEDS.length} legal authority rows`);
  console.log(`Seeded ${LEGAL_SOURCE_CONNECTOR_SEEDS.length} legal source connectors`);
  console.log(`Seeded ${Object.keys(INTERNAL_AGENTS).length} AI agents`);
  console.log(`Seeded ${modelCosts.length} AI model cost configs`);
  console.log(`Seeded ${creditPackSeeds.length * packCountries.length} credit packs`);
  console.log(`Platform admin ready: ${adminEmail.toLowerCase()}`);
  console.log('Seeded multi-country demo tenants, lawyers, playbooks, and automations');
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
