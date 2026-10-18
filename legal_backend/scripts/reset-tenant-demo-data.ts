/**
 * Admin script: wipe all matters, clients, leads, alerts and related data
 * for a tenant by email address.
 *
 * Usage:
 *   npx ts-node --transpile-only -r tsconfig-paths/register \
 *     scripts/reset-tenant-demo-data.ts --email=user@example.com
 *
 * Dry-run (count only, no deletes):
 *   ... --email=user@example.com --dry-run
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function parseArgs() {
  const args = process.argv.slice(2);
  const emailArg = args.find((a) => a.startsWith('--email='));
  const dryRun = args.includes('--dry-run');
  const email = emailArg?.split('=')[1];
  if (!email) {
    console.error('Usage: --email=user@example.com [--dry-run]');
    process.exit(1);
  }
  return { email, dryRun };
}

async function main() {
  const { email, dryRun } = parseArgs();

  // ── 1. Resolve tenant ────────────────────────────────────────────────────
  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      tenantUsers: {
        where: { status: 'ACTIVE' },
        include: { tenant: true },
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  if (!user) {
    console.error(`User not found: ${email}`);
    process.exit(1);
  }

  const membership = user.tenantUsers[0];
  if (!membership?.tenant) {
    console.error(`No active tenant membership for ${email}`);
    process.exit(1);
  }

  const { tenantId } = membership;
  console.log(`\nUser       : ${email} (${user.id})`);
  console.log(`Tenant     : ${membership.tenant.name} (${tenantId})`);
  console.log(`Mode       : ${dryRun ? 'DRY RUN — no changes' : 'LIVE'}\n`);

  // ── 2. Count existing data ───────────────────────────────────────────────
  const [
    alerts, timelineEvents, notifications, auditLogs,
    leads, tasks, taskParticipants, taskComments,
    timeEntries, meetings, meetingTranscripts, meetingNotes,
    documents, documentFolders, documentVersions, documentAccessRules, documentShareLinks,
    calendarEvents, aiOutputs, aiUsageLogs, expenses, claims, fixedCosts,
    automationRules, assistanceRequests, matterNotes, matterPlaybooks, matterAccess,
    matterFacts, matterIssues, matterArguments, matterStrategyMemos, matterParties,
    matterOutcomes, matterBudgets, matters, clients,
  ] = await Promise.all([
    prisma.alert.count({ where: { tenantId } }),
    prisma.timelineEvent.count({ where: { tenantId } }),
    prisma.notification.count({ where: { tenantId } }),
    prisma.auditLog.count({ where: { tenantId } }),
    prisma.lawyerLead.count({ where: { tenantId } }),
    prisma.task.count({ where: { tenantId } }),
    prisma.taskParticipant.count({ where: { tenantId } }),
    prisma.taskComment.count({ where: { tenantId } }),
    prisma.timeEntry.count({ where: { tenantId } }),
    prisma.meeting.count({ where: { tenantId } }),
    prisma.meetingTranscript.count({ where: { tenantId } }),
    prisma.meetingNote.count({ where: { tenantId } }),
    prisma.document.count({ where: { tenantId } }),
    prisma.documentFolder.count({ where: { tenantId } }),
    prisma.documentVersion.count({ where: { tenantId } }),
    prisma.documentAccessRule.count({ where: { tenantId } }),
    prisma.documentShareLink.count({ where: { tenantId } }),
    prisma.calendarEvent.count({ where: { tenantId } }),
    prisma.aIOutput.count({ where: { tenantId } }),
    prisma.aIUsageLog.count({ where: { tenantId } }),
    prisma.expense.count({ where: { tenantId } }),
    prisma.claim.count({ where: { tenantId } }),
    prisma.fixedCost.count({ where: { tenantId } }),
    prisma.automationRule.count({ where: { tenantId } }),
    prisma.assistanceRequest.count({ where: { tenantId } }),
    prisma.matterNote.count({ where: { tenantId } }),
    prisma.matterPlaybook.count({ where: { tenantId } }),
    prisma.matterAccess.count({ where: { tenantId } }),
    prisma.matterFact.count({ where: { tenantId } }),
    prisma.matterIssue.count({ where: { tenantId } }),
    prisma.matterArgument.count({ where: { tenantId } }),
    prisma.matterStrategyMemo.count({ where: { tenantId } }),
    prisma.matterParty.count({ where: { tenantId } }),
    prisma.matterOutcomeAnalysis.count({ where: { tenantId } }),
    prisma.matterBudget.count({ where: { tenantId } }),
    prisma.matter.count({ where: { tenantId } }),
    prisma.client.count({ where: { tenantId } }),
  ]);

  console.log('Records to delete:');
  console.log(`  Alerts           : ${alerts}`);
  console.log(`  Timeline events  : ${timelineEvents}`);
  console.log(`  Notifications    : ${notifications}`);
  console.log(`  Audit logs       : ${auditLogs}`);
  console.log(`  Leads            : ${leads}`);
  console.log(`  Tasks            : ${tasks} (+ ${taskParticipants} participants, ${taskComments} comments)`);
  console.log(`  Time entries     : ${timeEntries}`);
  console.log(`  Meetings         : ${meetings} (+ ${meetingTranscripts} transcripts, ${meetingNotes} notes)`);
  console.log(`  Documents        : ${documents} (+ ${documentFolders} folders, ${documentVersions} versions, ${documentAccessRules} rules, ${documentShareLinks} share links)`);
  console.log(`  Calendar events  : ${calendarEvents}`);
  console.log(`  AI outputs/logs  : ${aiOutputs} / ${aiUsageLogs}`);
  console.log(`  Expenses         : ${expenses}`);
  console.log(`  Claims           : ${claims}`);
  console.log(`  Fixed costs      : ${fixedCosts}`);
  console.log(`  Automation rules : ${automationRules}`);
  console.log(`  Matter notes     : ${matterNotes}`);
  console.log(`  Matter playbooks : ${matterPlaybooks}`);
  console.log(`  Matter access    : ${matterAccess}`);
  console.log(`  Matter facts     : ${matterFacts}`);
  console.log(`  Matter issues    : ${matterIssues}`);
  console.log(`  Matter args      : ${matterArguments}`);
  console.log(`  Matter memos     : ${matterStrategyMemos}`);
  console.log(`  Matter parties   : ${matterParties}`);
  console.log(`  Matter outcomes  : ${matterOutcomes}`);
  console.log(`  Matter budgets   : ${matterBudgets}`);
  console.log(`  Matters          : ${matters}`);
  console.log(`  Clients          : ${clients}`);
  console.log(`  Assistance reqs  : ${assistanceRequests}`);

  if (dryRun) {
    console.log('\nDry run complete — no data deleted.\n');
    return;
  }

  // ── 3. Delete in FK-safe order ────────────────────────────────────────────
  // Leaf nodes first (children before parents).
  // Cascade-deleted children (TaskParticipant, TaskComment, MeetingTranscript,
  // MeetingNote, DocumentVersion, DocumentAccessRule) are handled by Prisma
  // cascade but we delete them explicitly anyway for a clean count.

  console.log('\nDeleting...');

  await prisma.$transaction(
    async (tx) => {
      // Level 0 — independent leaf tables
      await tx.alert.deleteMany({ where: { tenantId } });
      await tx.timelineEvent.deleteMany({ where: { tenantId } });
      await tx.notification.deleteMany({ where: { tenantId } });
      await tx.auditLog.deleteMany({ where: { tenantId } });
      await tx.calendarEvent.deleteMany({ where: { tenantId } });
      await tx.aIOutput.deleteMany({ where: { tenantId } });
      await tx.aIUsageLog.deleteMany({ where: { tenantId } });
      await tx.expense.deleteMany({ where: { tenantId } });
      await tx.claim.deleteMany({ where: { tenantId } });
      await tx.fixedCost.deleteMany({ where: { tenantId } });
      await tx.automationRule.deleteMany({ where: { tenantId } });
      await tx.assistanceRequest.deleteMany({ where: { tenantId } });
      await tx.lawyerLead.deleteMany({ where: { tenantId } });

      // Matter children (before matters)
      await tx.matterNote.deleteMany({ where: { tenantId } });
      await tx.matterPlaybook.deleteMany({ where: { tenantId } });
      await tx.matterAccess.deleteMany({ where: { tenantId } });
      await tx.matterFact.deleteMany({ where: { tenantId } });
      await tx.matterIssue.deleteMany({ where: { tenantId } });
      await tx.matterArgument.deleteMany({ where: { tenantId } });
      await tx.matterStrategyMemo.deleteMany({ where: { tenantId } });
      await tx.matterParty.deleteMany({ where: { tenantId } });
      await tx.matterOutcomeAnalysis.deleteMany({ where: { tenantId } });
      await tx.matterBudget.deleteMany({ where: { tenantId } });

      // Task children (before tasks)
      await tx.taskParticipant.deleteMany({ where: { tenantId } });
      await tx.taskComment.deleteMany({ where: { tenantId } });
      await tx.task.deleteMany({ where: { tenantId } });
      await tx.timeEntry.deleteMany({ where: { tenantId } });

      // Meeting children (before meetings)
      await tx.meetingTranscript.deleteMany({ where: { tenantId } });
      await tx.meetingNote.deleteMany({ where: { tenantId } });
      await tx.meeting.deleteMany({ where: { tenantId } });

      // Document children (before documents)
      await tx.documentShareLink.deleteMany({ where: { tenantId } });
      await tx.documentAccessRule.deleteMany({ where: { tenantId } });
      await tx.documentVersion.deleteMany({ where: { tenantId } });
      await tx.documentFolder.deleteMany({ where: { tenantId } });
      await tx.document.deleteMany({ where: { tenantId } });

      // Top-level entities
      await tx.matter.deleteMany({ where: { tenantId } });
      await tx.client.deleteMany({ where: { tenantId } });
    },
    { timeout: 60_000 },
  );

  console.log('  Done.\n');
  console.log(
    `Deleted: ${alerts} alerts, ${timelineEvents} timeline events, ${notifications} notifications, ` +
    `${auditLogs} audit logs, ${leads} leads, ${tasks} tasks, ${timeEntries} time entries, ` +
    `${meetings} meetings, ${documents} documents, ${matters} matters, ${clients} clients.\n`,
  );
  console.log(`Tenant "${membership.tenant.name}" is now empty.\n`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
