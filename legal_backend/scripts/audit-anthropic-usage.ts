/**
 * Claude / Anthropic spend audit — groups AIUsageLog by task type.
 *
 * Usage:
 *   npm run audit:anthropic-usage [-- --from=2026-01-01] [-- --to=2026-12-31] [-- --tenantId=...]
 */
import './cli-bootstrap';
import { PrismaClient } from '@prisma/client';
import { resolveModelProvider } from '../src/ai/model-costs.config';
import { AiModelEnvAuditService } from '../src/ai/ai-model-env-audit.service';
import { ConfigService } from '@nestjs/config';

const prisma = new PrismaClient();

function parseArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = process.argv.find((arg) => arg.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : undefined;
}

function buildDateRange(from?: string, to?: string) {
  if (!from && !to) return undefined;
  const range: { gte?: Date; lte?: Date } = {};
  if (from) range.gte = new Date(from);
  if (to) {
    const end = new Date(to);
    end.setHours(23, 59, 59, 999);
    range.lte = end;
  }
  return range;
}

async function main() {
  const from = parseArg('from');
  const to = parseArg('to');
  const tenantId = parseArg('tenantId');
  const createdAt = buildDateRange(from, to);

  const where = {
    status: 'SUCCESS' as const,
    OR: [{ modelProvider: 'anthropic' }, { modelName: { startsWith: 'claude-' } }],
    tenantId: tenantId || undefined,
    ...(createdAt ? { createdAt } : {}),
  };

  const rows = await prisma.aIUsageLog.groupBy({
    by: ['taskType', 'modelName', 'modelProvider'],
    where,
    _count: { id: true },
    _sum: {
      costUsd: true,
      chargedCredits: true,
      inputTokens: true,
      outputTokens: true,
    },
    orderBy: { _sum: { costUsd: 'desc' } },
  });

  const byTaskType = new Map<
    string,
    {
      taskType: string;
      requests: number;
      costUsd: number;
      chargedCredits: number;
      models: string[];
    }
  >();

  for (const row of rows) {
    const taskType = row.taskType ?? 'unknown';
    const entry = byTaskType.get(taskType) ?? {
      taskType,
      requests: 0,
      costUsd: 0,
      chargedCredits: 0,
      models: [],
    };
    const costUsd = Number(row._sum.costUsd ?? 0);
    entry.requests += row._count.id;
    entry.costUsd += costUsd;
    entry.chargedCredits += row._sum.chargedCredits ?? 0;
    const modelLabel = `${row.modelName ?? 'unknown'} (${row.modelProvider ?? 'unknown'})`;
    if (!entry.models.includes(modelLabel)) entry.models.push(modelLabel);
    byTaskType.set(taskType, entry);
  }

  const items = [...byTaskType.values()].sort((a, b) => b.costUsd - a.costUsd);
  const totals = items.reduce(
    (acc, item) => ({
      requests: acc.requests + item.requests,
      costUsd: acc.costUsd + item.costUsd,
      chargedCredits: acc.chargedCredits + item.chargedCredits,
    }),
    { requests: 0, costUsd: 0, chargedCredits: 0 },
  );

  const configService = new ConfigService(process.env);
  const envAudit = new AiModelEnvAuditService(configService).buildAudit();

  const tenantRows = await prisma.tenant.groupBy({
    by: ['deepAnalysisPremiumModelId'],
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } },
  });

  console.log('Anthropic (Claude) usage audit');
  console.log('==============================');
  if (from || to) console.log(`Date range: ${from ?? '…'} → ${to ?? '…'}`);
  if (tenantId) console.log(`Tenant: ${tenantId}`);
  console.log('');
  console.log('Totals');
  console.log(`  Requests: ${totals.requests}`);
  console.log(`  Cost USD: $${totals.costUsd.toFixed(4)}`);
  console.log(`  Charged credits: ${totals.chargedCredits}`);
  console.log('');

  if (items.length === 0) {
    console.log('No Anthropic usage rows found.');
  } else {
    console.log('By task type');
    for (const item of items) {
      console.log(
        `  ${item.taskType}: ${item.requests} req, $${item.costUsd.toFixed(4)}, ${item.chargedCredits} cr`,
      );
      console.log(`    models: ${item.models.join(', ')}`);
    }
  }

  console.log('');
  console.log('Env model audit');
  console.log(`  ANTHROPIC_API_KEY configured: ${envAudit.anthropicApiKeyConfigured}`);
  console.log(`  Claude in legal-research env path: ${envAudit.claudeInLegalResearchPath}`);
  for (const entry of envAudit.legalResearchModels) {
    const flag = entry.isClaude ? ' [CLAUDE]' : '';
    console.log(`  ${entry.key}=${entry.value} (${entry.provider})${flag}`);
  }
  console.log(`  AI_PREMIUM_MODELS: ${envAudit.premiumModels.join(', ')}`);
  for (const note of envAudit.notes) {
    console.log(`  note: ${note}`);
  }

  console.log('');
  console.log('Tenant deepAnalysisPremiumModelId');
  for (const row of tenantRows) {
    const isClaude = row.deepAnalysisPremiumModelId.startsWith('claude-');
    const provider = resolveModelProvider(row.deepAnalysisPremiumModelId);
    console.log(
      `  ${row.deepAnalysisPremiumModelId}: ${row._count.id} tenant(s) (${provider}${isClaude ? ', Claude default' : ''})`,
    );
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
