/**
 * Seeds AdminTodoTemplate rows for CTO and CFO_CMO profiles.
 * Based on business plan execution tasks (July sprint + weekly cadence).
 * Idempotent: upserts by (adminProfile + title).
 *
 * Usage: npm run seed:admin-todos
 */
import { PrismaClient } from '@prisma/client';

interface TemplateSeed {
  adminProfile: string;
  title: string;
  description?: string;
  category: string;
  dayOfWeek: number | null; // null = every day
  sortOrder: number;
}

const TEMPLATES: TemplateSeed[] = [
  // ── CTO (Engineering) — Daily ────────────────────────────────────────
  {
    adminProfile: 'CTO',
    title: 'Review error rates & generation failures',
    description: 'Check CloudWatch / monitoring dashboard for India drafting and research failures. Target < 5%.',
    category: 'engineering',
    dayOfWeek: null,
    sortOrder: 10,
  },
  {
    adminProfile: 'CTO',
    title: 'Review support tickets from lawyers',
    description: 'Check WhatsApp + email for product issues from new lawyer sign-ups. Respond within 2 hours.',
    category: 'engineering',
    dayOfWeek: null,
    sortOrder: 20,
  },
  {
    adminProfile: 'CTO',
    title: 'Check activation funnel drop-off',
    description: 'In PostHog/analytics: where are new sign-ups abandoning? Fix the top drop-off step this week.',
    category: 'engineering',
    dayOfWeek: null,
    sortOrder: 30,
  },

  // ── CTO — Monday ─────────────────────────────────────────────────────
  {
    adminProfile: 'CTO',
    title: 'Assign 2 engineering tasks for the week',
    description: 'Review funnel data and pick the top 2 product fixes. Create tickets.',
    category: 'engineering',
    dayOfWeek: 1,
    sortOrder: 100,
  },
  {
    adminProfile: 'CTO',
    title: 'Weekly growth meeting — product update',
    description: 'Attend Monday 9AM growth meeting. Bring: funnel data, top drop-off, last week ships.',
    category: 'ops',
    dayOfWeek: 1,
    sortOrder: 110,
  },

  // ── CTO — Tuesday/Thursday ────────────────────────────────────────────
  {
    adminProfile: 'CTO',
    title: 'Ship one product fix or feature',
    description: 'Push at least 1 fix to production from this week\'s queue. Update public changelog.',
    category: 'engineering',
    dayOfWeek: 2,
    sortOrder: 200,
  },
  {
    adminProfile: 'CTO',
    title: 'Ship one product fix or feature',
    description: 'Push at least 1 fix to production from this week\'s queue. Update public changelog.',
    category: 'engineering',
    dayOfWeek: 4,
    sortOrder: 200,
  },

  // ── CTO — Wednesday ───────────────────────────────────────────────────
  {
    adminProfile: 'CTO',
    title: '5 lawyer onboarding / user calls',
    description: 'Run or observe 5 lawyer sessions. Ask: "What almost made you leave?" Log insights in Slack.',
    category: 'ops',
    dayOfWeek: 3,
    sortOrder: 300,
  },

  // ── CTO — Friday ──────────────────────────────────────────────────────
  {
    adminProfile: 'CTO',
    title: 'Publish weekly changelog',
    description: 'Post "What we shipped this week" on /changelog or Slack + social. Builds trust post-launch.',
    category: 'engineering',
    dayOfWeek: 5,
    sortOrder: 400,
  },
  {
    adminProfile: 'CTO',
    title: 'Demo latest builds to co-founder',
    description: 'Show Garima any new features or UX changes live. Get feedback before next week\'s sprint.',
    category: 'ops',
    dayOfWeek: 5,
    sortOrder: 410,
  },

  // ── CFO_CMO (Garima) — Daily ──────────────────────────────────────────
  {
    adminProfile: 'CFO_CMO',
    title: 'Respond to all lawyer WhatsApp support messages',
    description: 'Check WhatsApp Business inbox. Respond within 2 hours. Log issues for CTO.',
    category: 'ops',
    dayOfWeek: null,
    sortOrder: 10,
  },
  {
    adminProfile: 'CFO_CMO',
    title: 'Send personal welcome to every new lawyer sign-up',
    description: 'DM every new sign-up from the admin Users panel. Offer 15-min onboarding call via Calendly.',
    category: 'marketing',
    dayOfWeek: null,
    sortOrder: 20,
  },
  {
    adminProfile: 'CFO_CMO',
    title: 'Update daily metrics sheet',
    description: 'Update Google Sheet with sign-ups, activated, paid, CAC by channel. Check vs daily target.',
    category: 'finance',
    dayOfWeek: null,
    sortOrder: 30,
  },

  // ── CFO_CMO — Monday ──────────────────────────────────────────────────
  {
    adminProfile: 'CFO_CMO',
    title: 'Lead weekly growth meeting',
    description: 'Run Monday 9AM growth meeting. Review: North Star (D7 retention), funnel, channel scorecard, user calls, set weekly targets.',
    category: 'ops',
    dayOfWeek: 1,
    sortOrder: 100,
  },
  {
    adminProfile: 'CFO_CMO',
    title: 'Review MRR and burn rate',
    description: 'Check Stripe dashboard: new MRR, churn, vs plan. Update weekly finance tracker.',
    category: 'finance',
    dayOfWeek: 1,
    sortOrder: 110,
  },

  // ── CFO_CMO — Tuesday ─────────────────────────────────────────────────
  {
    adminProfile: 'CFO_CMO',
    title: '2 influencer reels go live',
    description: 'Approve and publish 2 reels from this week\'s influencer queue. Confirm UTM links are live.',
    category: 'marketing',
    dayOfWeek: 2,
    sortOrder: 200,
  },
  {
    adminProfile: 'CFO_CMO',
    title: '50 outbound DMs to lawyers',
    description: 'DM 50 advocates on LinkedIn/Instagram/WhatsApp. Use: IPC drafting wedge or FIR analysis angle.',
    category: 'marketing',
    dayOfWeek: 2,
    sortOrder: 210,
  },

  // ── CFO_CMO — Wednesday ───────────────────────────────────────────────
  {
    adminProfile: 'CFO_CMO',
    title: '5 lawyer user discovery calls',
    description: 'Call 5 lawyers (India/US mix). Ask: "What would you pay double for? What almost made you leave?"',
    category: 'ops',
    dayOfWeek: 3,
    sortOrder: 300,
  },
  {
    adminProfile: 'CFO_CMO',
    title: 'Trial conversion nudges (Day 7/14/25)',
    description: 'Send personal WhatsApp to all trial users at D7, D14, and D25. Use price anchor: ₹1,400 = one consult.',
    category: 'marketing',
    dayOfWeek: 3,
    sortOrder: 310,
  },

  // ── CFO_CMO — Thursday ────────────────────────────────────────────────
  {
    adminProfile: 'CFO_CMO',
    title: 'Webinar or live demo',
    description: 'Run or promote this week\'s lawyer webinar / demo session. Log attendees and sign-ups generated.',
    category: 'marketing',
    dayOfWeek: 4,
    sortOrder: 400,
  },
  {
    adminProfile: 'CFO_CMO',
    title: 'US lawyer community engagement',
    description: 'Post in 1 US legal tech community (LinkedIn, Twitter, subreddit). Share product update or case study.',
    category: 'marketing',
    dayOfWeek: 4,
    sortOrder: 410,
  },

  // ── CFO_CMO — Friday ──────────────────────────────────────────────────
  {
    adminProfile: 'CFO_CMO',
    title: 'Weekly MRR report',
    description: 'Compile MRR, CAC, conversion rate. Share to team Slack. Flag if behind monthly target.',
    category: 'finance',
    dayOfWeek: 5,
    sortOrder: 500,
  },
  {
    adminProfile: 'CFO_CMO',
    title: 'Approve influencer payments',
    description: 'Review approved reels this week. Process payments within 7 business days of approval.',
    category: 'finance',
    dayOfWeek: 5,
    sortOrder: 510,
  },
  {
    adminProfile: 'CFO_CMO',
    title: 'Publish 1 social proof post',
    description: 'Share a testimonial screenshot, metric win, or lawyer story on LinkedIn + Instagram.',
    category: 'marketing',
    dayOfWeek: 5,
    sortOrder: 520,
  },

  // ── CFO_CMO — Saturday ────────────────────────────────────────────────
  {
    adminProfile: 'CFO_CMO',
    title: 'Founder content (reel or LinkedIn post)',
    description: 'Record or write 1 piece of founder content. Show behind-the-scenes, product demo, or growth story.',
    category: 'marketing',
    dayOfWeek: 6,
    sortOrder: 600,
  },
];

async function main() {
  const prisma = new PrismaClient();
  let created = 0;
  let updated = 0;

  for (const t of TEMPLATES) {
    const existing = await prisma.adminTodoTemplate.findFirst({
      where: { adminProfile: t.adminProfile, title: t.title },
      select: { id: true },
    });

    if (existing) {
      await prisma.adminTodoTemplate.update({
        where: { id: existing.id },
        data: {
          description: t.description,
          category: t.category,
          dayOfWeek: t.dayOfWeek,
          sortOrder: t.sortOrder,
          isActive: true,
        },
      });
      updated++;
    } else {
      await prisma.adminTodoTemplate.create({
        data: {
          adminProfile: t.adminProfile,
          title: t.title,
          description: t.description,
          category: t.category,
          dayOfWeek: t.dayOfWeek,
          sortOrder: t.sortOrder,
          isActive: true,
        },
      });
      created++;
    }
  }

  console.log(`Admin todo templates: ${created} created, ${updated} updated`);
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
