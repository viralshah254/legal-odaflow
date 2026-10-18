/**
 * Bulk-provision templates to demo seed tenants and create assemble-only draft
 * Document rows on sample matters (no LLM).
 *
 * Run: npx ts-node -r tsconfig-paths/register scripts/seed-sample-draft-documents.ts
 */
import { PrismaClient } from '@prisma/client';
import { DocumentAutomationService } from '../src/document-automation/document-automation.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { PRACTICE_AREAS } from '../src/config/practice-areas';

const prisma = new PrismaClient();

const DEMO_TENANT_IDS = ['seed-in', 'seed-us', 'seed-ke'];

const PRACTICE_AREA_LABEL: Record<string, string> = {
  corporate_commercial: 'Corporate',
  employment_labour: 'Employment',
  family_matrimonial: 'Family',
  real_estate_property: 'Real Estate',
  criminal_defense: 'Criminal',
  immigration: 'Immigration',
  intellectual_property: 'Intellectual Property',
  litigation_disputes: 'Litigation',
  tax: 'Tax',
  wills_estates_probate: 'Wills & Estates',
};

const SAMPLE_ANSWERS: Record<string, string | boolean> = {
  party1Name: 'Acme Holdings Ltd',
  party1Address: '100 Main Street, Sample City',
  party2Name: 'Jane Sample',
  party2Address: '42 Oak Avenue, Sample City',
  servicesDescription: 'Professional services as described in Schedule 1',
  paymentTerms: 'Net 30 days from invoice',
  contractStartDate: '2026-07-01',
  contractEndDate: '2027-06-30',
  governingLaw: 'Applicable local law',
  jobTitle: 'Senior Associate',
  salary: '85000 per annum',
  probationPeriod: '3 months',
  noticePeriod: '30 days',
  ipOwnership: 'client',
  paymentSchedule: 'monthly',
  documentType: 'employment_contract',
};

async function main() {
  const prismaService = new PrismaService();
  const automation = new DocumentAutomationService(prismaService);

  let provisioned = 0;
  let draftsCreated = 0;

  for (const tenantId of DEMO_TENANT_IDS) {
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) {
      console.warn(`Skip missing tenant ${tenantId}`);
      continue;
    }

    const countryCode = tenant.primaryCountry;
    const tenantUser = await prisma.tenantUser.findFirst({
      where: {
        tenantId,
        status: 'ACTIVE',
        role: { in: ['PARTNER_ADMIN', 'ASSOCIATE', 'FIRM_ADMIN', 'LAWYER', 'ADMIN'] },
      },
      select: { userId: true },
    });
    const lawyer = tenantUser ? { id: tenantUser.userId } : null;
    if (!lawyer) {
      console.warn(`No lawyer for tenant ${tenantId}`);
      continue;
    }

    const systemTemplates = await prisma.systemDocumentTemplate.findMany({
      where: { countryCode, isActive: true, category: 'GENERAL_TEMPLATE' },
      take: 200,
      orderBy: { sortOrder: 'asc' },
    });

    for (const system of systemTemplates) {
      const existing = await prisma.documentTemplate.findFirst({
        where: { tenantId, systemTemplateId: system.id },
      });
      if (!existing) {
        await prisma.documentTemplate.create({
          data: {
            tenantId,
            name: system.name,
            content: system.content,
            category: system.category,
            countryCode: system.countryCode,
            practiceArea: system.practiceArea,
            documentKind: system.documentKind,
            jurisdiction: system.jurisdiction,
            conditionalFields: system.conditionalFields ?? undefined,
            source: 'SYSTEM',
            systemTemplateId: system.id,
            isActive: true,
          },
        });
        provisioned++;
      }
    }

    const client = await prisma.client.findFirst({ where: { tenantId } });
    if (!client) continue;

    for (const area of PRACTICE_AREAS) {
      const matter = await prisma.matter.upsert({
        where: { id: `sample-draft-${tenantId}-${area.slug}` },
        create: {
          id: `sample-draft-${tenantId}-${area.slug}`,
          tenantId,
          clientId: client.id,
          title: `Sample ${area.label} Draft Matter`,
          practiceArea: PRACTICE_AREA_LABEL[area.slug] ?? area.label,
          matterType: 'DRAFTING',
          countryCode,
          status: 'OPEN',
          factsSummary: 'Sample matter for template library draft previews.',
          planningAnswers: SAMPLE_ANSWERS,
        },
        update: {
          planningAnswers: SAMPLE_ANSWERS,
        },
      });

      const template = await prisma.documentTemplate.findFirst({
        where: { tenantId, practiceArea: area.slug, countryCode, isActive: true },
        orderBy: { updatedAt: 'desc' },
      });
      if (!template) continue;

      const existingDoc = await prisma.document.findFirst({
        where: {
          tenantId,
          matterId: matter.id,
          generatedFromTemplateId: template.id,
        },
      });
      if (existingDoc) continue;

      const assembled = await automation.assembleFromQuestionnaire(
        tenantId,
        template.id,
        SAMPLE_ANSWERS,
        {
          clientName: client.name,
          firmName: tenant.name,
          today: new Date().toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          }),
        },
      );

      await prisma.document.create({
        data: {
          tenantId,
          matterId: matter.id,
          clientId: client.id,
          fileName: `${template.name} — Sample Draft.html`,
          fileUrl: '',
          mimeType: 'text/html',
          htmlContent: assembled.body,
          visibility: 'PRIVATE',
          version: 1,
          generatedFromTemplateId: template.id,
          aiDraftStatus: 'DRAFT',
          uploadedById: lawyer.id,
        },
      });
      draftsCreated++;
    }
  }

  console.log(`Provisioned ${provisioned} tenant templates`);
  console.log(`Created ${draftsCreated} sample draft documents`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
