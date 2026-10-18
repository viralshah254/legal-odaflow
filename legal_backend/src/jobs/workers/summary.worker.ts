import { Worker, Job } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import { AI_JOB_TYPES } from '../jobs.constants';
import { REALTIME_EVENTS } from '@/realtime/realtime-events';
import { AiAgentJobPayload } from '../jobs.types';
import { QUEUE_NAMES } from '../jobs.constants';
import { getWorkerServices } from './worker-context';
import { buildMeetingNotesUserPrompt, MEETING_NOTES_SYSTEM_PROMPT } from '../../meetings/meeting-notes.prompt';
import { AI_TASK_TYPES } from '@/ai-credits/task-types';
interface MeetingTranscribeJobPayload {
  meetingId: string;
  tenantId: string;
  userId: string;
  audioStorageKey: string;
  mimeType: string;
  durationMs?: number;
}

const prisma = new PrismaClient();

function getRedisConnectionOptions() {
  return {
    url: process.env.REDIS_URL ?? 'redis://localhost:6379',
    maxRetriesPerRequest: null,
  };
}

async function loadMatterContext(tenantId: string, matterId?: string) {
  if (!matterId) {
    return null;
  }

  return prisma.matter.findFirst({
    where: { id: matterId, tenantId },
    include: {
      client: true,
      tasks: { take: 10, orderBy: { createdAt: 'desc' } },
    },
  });
}

async function processSummaryJob(job: Job<AiAgentJobPayload>) {
  const payload = job.data;

  await prisma.agentJob.update({
    where: { id: payload.agentJobId },
    data: { status: 'PROCESSING', attempts: { increment: 1 } },
  });

  const { aiGateway, automationEngine, realtime, llmCompletion } = await getWorkerServices();
  realtime.publishToTenant(payload.tenantId, REALTIME_EVENTS.AGENT_JOB_UPDATED, {
    entityId: payload.agentJobId,
    action: 'processing',
    userId: payload.userId,
  });

  const matter = await loadMatterContext(
    payload.tenantId,
    payload.params.matterId as string | undefined,
  );

  let outputMarkdown = '';
  let provider = 'internal';
  let modelName = 'heuristic-fallback-v1';

  if (payload.jobType === AI_JOB_TYPES.DOCUMENT_EXPLAINER) {
    const result = await aiGateway.runDocumentExplain({
      userId: payload.userId,
      tenantId: payload.tenantId,
      matterId: payload.params.matterId as string | undefined,
      documentId: String(payload.params.documentId ?? ''),
      documentText: String(payload.params.documentText ?? ''),
    });
    outputMarkdown = result.outputMarkdown;
    provider = result.provider;
    modelName = result.modelName;
  } else if (payload.jobType === AI_JOB_TYPES.EVIDENCE_GAP) {
    const result = await aiGateway.runEvidenceGapAnalysis({
      userId: payload.userId,
      tenantId: payload.tenantId,
      matterId: payload.params.matterId as string | undefined,
      matterTitle: payload.params.matterTitle as string | undefined,
      factsSummary: String(payload.params.factsSummary ?? ''),
    });
    outputMarkdown = result.outputMarkdown;
    provider = result.provider;
    modelName = result.modelName;
  } else if (payload.jobType === AI_JOB_TYPES.BILLING_RECOVERY) {
    const result = await aiGateway.runBillingRecovery({
      userId: payload.userId,
      tenantId: payload.tenantId,
      matterId: payload.params.matterId as string | undefined,
    });
    outputMarkdown = result.outputMarkdown;
    provider = result.provider;
    modelName = result.modelName;
  } else if (payload.toolName === 'summarize_matter') {
    const summary = await aiGateway.runMatterSummary({
      userId: payload.userId,
      tenantId: payload.tenantId,
      matterId: payload.params.matterId as string | undefined,
      matterTitle: matter?.title,
      matterStatus: matter?.status,
      practiceArea: matter?.practiceArea ?? undefined,
      clientName: matter?.client?.name ?? undefined,
      openTasks: matter?.tasks.map((task) => ({
        title: task.title,
        status: task.status,
      })),
    });
    outputMarkdown = summary.outputMarkdown;
    provider = summary.provider;
    modelName = summary.modelName;
  } else if (payload.jobType === AI_JOB_TYPES.OUTCOME_REFRESH) {
    const { matterOutcome: matterOutcomeService } = await getWorkerServices();
    if (matterOutcomeService && payload.params.matterId) {
      await matterOutcomeService.generate(
        payload.tenantId,
        String(payload.params.matterId),
        payload.userId,
        payload.userRole,
      );
      outputMarkdown = 'Outcome analysis refresh completed.';
      provider = 'matter-outcome';
      modelName = 'outcome-refresh-v1';
    } else {
      outputMarkdown = 'Outcome refresh skipped — matter outcome service unavailable.';
    }
  } else if (payload.toolName === 'draft_document') {
    const { isFilingGradeDraftKind } = await import('@/ai/drafting/draft-citation-policy');
    const documentType = String(payload.params.documentType ?? 'memo');
    if (isFilingGradeDraftKind(documentType) && payload.tenantId) {
      const { draftJobService } = await getWorkerServices();
      const job = await draftJobService.create({
        tenantId: payload.tenantId,
        userId: payload.userId,
        matterId: payload.params.matterId as string | undefined,
        profile: 'india_court',
        documentKind: documentType,
        qualityTier: 'standard',
        facts: String(payload.params.instructions ?? matter?.title ?? documentType),
        jurisdiction: matter?.jurisdiction ?? 'IN',
        clientName: matter?.client?.name ?? undefined,
      });
      outputMarkdown = [
        `Filing-grade draft started as DraftJob \`${job.jobId}\`.`,
        'Copy and export stay blocked until the Case Record is confirmed (`canExport=false`).',
      ].join(' ');
      provider = 'unified-draft-job';
      modelName = documentType;
    } else {
      const draft = await aiGateway.runDocumentDraft({
        userId: payload.userId,
        tenantId: payload.tenantId,
        matterId: payload.params.matterId as string | undefined,
        matterTitle: matter?.title,
        documentType,
        instructions: String(payload.params.instructions ?? ''),
      });
      outputMarkdown = draft.outputMarkdown;
      provider = draft.provider;
      modelName = draft.modelName;
    }
  } else if (payload.jobType === AI_JOB_TYPES.LEAD_DRAFT_GENERATE) {
    const { draftingWorkspace } = await getWorkerServices();
    const leadId = String(payload.params.leadId ?? '');
    const lead = await prisma.lawyerLead.findUnique({ where: { id: leadId } });
    if (lead?.convertedMatterId && lead.tenantId) {
      const generated = await draftingWorkspace.generateDraft(
        lead.tenantId,
        payload.userId,
        lead.convertedMatterId,
      );
      outputMarkdown = `Draft document created: ${generated.documentId}`;
      provider = generated.provider;
      modelName = generated.modelName;
    } else {
      outputMarkdown = 'Draft generation deferred until lead is converted to a matter.';
    }
  } else if (
    payload.jobType === AI_JOB_TYPES.SUGGEST_NEXT_STEPS ||
    payload.toolName === 'suggest_next_steps'
  ) {
    const resolvedModel = process.env.AI_FAST_MODEL ?? 'gpt-4.1-mini';
    const prompt = [
      'Suggest 3–5 concrete next steps for the lawyer to take right now on this matter.',
      matter?.title ? `Matter: ${matter.title}` : 'Matter: Unspecified',
      matter?.status ? `Status: ${matter.status}` : '',
      matter?.practiceArea ? `Practice area: ${matter.practiceArea}` : '',
      matter?.client?.name ? `Client: ${matter.client.name}` : '',
      matter?.tasks?.length
        ? `Open tasks:\n${matter.tasks.map((task) => `- ${task.title} (${task.status})`).join('\n')}`
        : 'Open tasks: none listed',
      'Return markdown with a "## Recommended next steps" section. Prioritize by urgency. Be specific and actionable.',
    ]
      .filter(Boolean)
      .join('\n');

    const completion = await llmCompletion.complete({
      modelName: resolvedModel,
      messages: [
        {
          role: 'system',
          content:
            'You are a legal copilot helping licensed attorneys prioritize work. Use only the matter context provided.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.2,
    });

    outputMarkdown = completion.content;
    provider = 'openai';
    modelName = resolvedModel;
  } else if (
    payload.jobType === AI_JOB_TYPES.MATTER_INIT ||
    payload.jobType === AI_JOB_TYPES.MATTER_REFRESH
  ) {
    const matterId = payload.params.matterId as string | undefined;
    const trigger = payload.params.trigger as string | undefined;
    if (matterId) {
      outputMarkdown = await runMatterAutonomyJob({
        matterId,
        tenantId: payload.tenantId,
        userId: payload.userId,
        jobType: payload.jobType,
        trigger,
        aiGateway,
      });
    } else {
      outputMarkdown = 'Matter autonomy job skipped — no matterId in payload.';
    }
    provider = 'matter-autonomy';
    modelName = 'autonomy-v1';
  } else {
    outputMarkdown = [
      '# Job completed',
      '',
      'This background job type is not yet supported.',
      matter ? `\n_Matter: ${matter.title}_` : '',
    ]
      .filter(Boolean)
      .join('\n');
  }

  const result = {
    toolName: payload.toolName,
    outputMarkdown,
    matterId: payload.params.matterId,
    provider,
    modelName,
  };

  await prisma.agentJob.update({
    where: { id: payload.agentJobId },
    data: {
      status: 'COMPLETED',
      completedAt: new Date(),
      result: result as object,
    },
  });

  const stepId = payload.params.stepId as string | undefined;
  if (stepId) {
    await prisma.copilotPlanStep.updateMany({
      where: { id: stepId, status: 'running' },
      data: { status: 'done' },
    });
    const step = await prisma.copilotPlanStep.findUnique({
      where: { id: stepId },
      select: { planId: true },
    });
    if (step?.planId) {
      const remaining = await prisma.copilotPlanStep.count({
        where: {
          planId: step.planId,
          status: { in: ['pending', 'running', 'needs_input'] },
        },
      });
      if (remaining === 0) {
        await prisma.copilotPlan.update({
          where: { id: step.planId },
          data: { status: 'completed' },
        });
      }
    }
  }

  if (payload.sessionId) {
    const copilotMessage = await prisma.copilotMessage.create({
      data: {
        sessionId: payload.sessionId,
        role: 'assistant',
        content: outputMarkdown,
        citations: [],
      },
    });

    realtime.publishToUser(payload.userId, REALTIME_EVENTS.COPILOT_MESSAGE_CREATED, {
      tenantId: payload.tenantId,
      entityId: copilotMessage.id,
      action: 'created',
      data: { sessionId: payload.sessionId, toolName: payload.toolName },
    });
    realtime.publishToUser(payload.userId, REALTIME_EVENTS.COPILOT_JOB_COMPLETED, {
      tenantId: payload.tenantId,
      entityId: payload.agentJobId,
      action: 'completed',
      data: { sessionId: payload.sessionId, toolName: payload.toolName },
    });
  }

  realtime.publishToTenant(payload.tenantId, REALTIME_EVENTS.AGENT_JOB_UPDATED, {
    entityId: payload.agentJobId,
    action: 'completed',
    userId: payload.userId,
  });
  realtime.publishDashboardRefresh(payload.tenantId, payload.agentJobId);

  // Emit autonomy-specific event so the frontend can show a toast and badge
  if (
    payload.jobType === AI_JOB_TYPES.MATTER_INIT ||
    payload.jobType === AI_JOB_TYPES.MATTER_REFRESH
  ) {
    const matterId = payload.params.matterId as string | undefined;
    if (matterId) {
      realtime.publishToTenant(payload.tenantId, REALTIME_EVENTS.MATTER_AUTONOMY_COMPLETED, {
        entityId: matterId,
        action: payload.jobType === AI_JOB_TYPES.MATTER_INIT ? 'init' : 'refresh',
        data: {
          matterId,
          jobType: payload.jobType,
          trigger: payload.params.trigger as string | undefined,
        },
      });
    }
  }

  try {
    await automationEngine.dispatch(payload.tenantId, 'agent.completed', {
      agentJobId: payload.agentJobId,
      jobType: payload.jobType,
      toolName: payload.toolName,
      userId: payload.userId,
      matterId: payload.params.matterId,
      status: 'COMPLETED',
    });
  } catch {
    // Automation dispatch should not fail the completed AI job.
  }

  return result;
}

async function runMatterAutonomyJob(input: {
  matterId: string;
  tenantId: string;
  userId: string;
  jobType: string;
  trigger?: string;
  aiGateway: import('@/ai/ai-gateway.service').AiGatewayService;
}): Promise<string> {
  const { matterId, tenantId, userId, trigger, aiGateway } = input;

  const matter = await prisma.matter.findFirst({
    where: { id: matterId, tenantId },
    include: { client: { select: { name: true } } },
  });
  if (!matter) {
    return `Matter ${matterId} not found — autonomy job skipped.`;
  }

  const facts = await prisma.matterFact.findMany({
    where: { tenantId, matterId },
    take: 20,
    orderBy: { createdAt: 'desc' },
  });
  const issues = await prisma.matterIssue.findMany({
    where: { tenantId, matterId },
    take: 15,
    orderBy: { updatedAt: 'desc' },
  });

  const factsText = facts.map((f: { factText: string }) => `- ${f.factText}`).join('\n') || 'No facts recorded.';
  const issuesText = issues.map((i: { title: string; description: string | null }) => `- ${i.title}: ${i.description ?? ''}`).join('\n') || 'No issues recorded.';

  const baseCtx = [
    `Matter: ${matter.title}`,
    `Practice Area: ${matter.practiceArea}`,
    `Country: ${matter.countryCode}`,
    matter.jurisdiction ? `Jurisdiction: ${matter.jurisdiction}` : '',
    matter.client ? `Client: ${matter.client.name}` : '',
    `\nFacts:\n${factsText}`,
    `\nIssues:\n${issuesText}`,
  ].filter(Boolean).join('\n');

  const results: string[] = [];

  // 1. Similar cases
  try {
    const simResult = await aiGateway.runIntakeDeepAnalysis({
      userId,
      tenantId,
      taskType: 'LEGAL_RESEARCH',
      systemPrompt: 'You are a senior legal researcher. Find similar landmark cases for this matter with citations, court, year, and binding weight.',
      userPrompt: `${baseCtx}\n\nFind similar cases. Return markdown table + case summaries.`,
      reasoningModel: false,
      countryCode: matter.countryCode,
      modelMode: 'AUTO',
    });

    await prisma.matterAnalysisRun.create({
      data: {
        tenantId,
        matterId,
        runType: 'similar_cases',
        trigger: trigger ?? 'auto',
        title: `Similar Cases — Auto (${new Date().toLocaleDateString()})`,
        contentMarkdown: simResult.outputMarkdown,
        status: 'COMPLETED',
        createdByUserId: userId,
      },
    });
    results.push('similar_cases: done');
  } catch (e) {
    results.push(`similar_cases: failed — ${String(e)}`);
  }

  // 2. Opponent analysis — only on init or status_change
  if (trigger !== 'document_upload') {
    try {
      const oppResult = await aiGateway.runIntakeDeepAnalysis({
        userId,
        tenantId,
        taskType: 'OPPONENT_ANALYZER',
        systemPrompt: 'You are an expert litigation strategist. Analyze the opposing side\'s strategy and recommend counter-strategies.',
        userPrompt: `${baseCtx}\n\nAnalyze opponent. Return: ## Opposing Strategy | ## Weaknesses to Address | ## Counter-Strategies`,
        reasoningModel: false,
        countryCode: matter.countryCode,
        modelMode: 'AUTO',
      });

      await prisma.matterAnalysisRun.create({
        data: {
          tenantId,
          matterId,
          runType: 'opponent_analysis',
          trigger: trigger ?? 'auto',
          title: `Opponent Analysis — Auto (${new Date().toLocaleDateString()})`,
          contentMarkdown: oppResult.outputMarkdown,
          status: 'COMPLETED',
          createdByUserId: userId,
        },
      });
      results.push('opponent_analysis: done');
    } catch (e) {
      results.push(`opponent_analysis: failed — ${String(e)}`);
    }
  }

  // 3. Strategy memo
  try {
    const stratResult = await aiGateway.runIntakeDeepAnalysis({
      userId,
      tenantId,
      taskType: 'STRATEGY_MEMO',
      systemPrompt: 'You are a senior litigation partner. Write a comprehensive legal strategy memo for this matter.',
      userPrompt: `${baseCtx}\n\nWrite a strategy memo. Sections: ## Executive Summary | ## Legal Strategy | ## Key Risks | ## Next Actions`,
      reasoningModel: false,
      countryCode: matter.countryCode,
      modelMode: 'AUTO',
    });

    await prisma.matterStrategyMemo.create({
      data: {
        tenantId,
        matterId,
        title: `Auto Strategy — ${new Date().toLocaleDateString()}`,
        content: stratResult.outputMarkdown,
        status: 'DRAFT',
        createdBy: userId,
      },
    });
    results.push('strategy_memo: done');
  } catch (e) {
    results.push(`strategy_memo: failed — ${String(e)}`);
  }

  return `Matter autonomy job completed (${trigger ?? 'auto'}): ${results.join(', ')}`;
}

/**
 * Compute Whisper-1 provider cost from audio duration.
 * OpenAI bills $0.006 per minute, rounding up to the nearest second.
 */
function computeWhisperCostUsd(durationMs: number): number {
  const durationMinutes = Math.max(1, Math.ceil(durationMs / 60_000));
  return durationMinutes * 0.006;
}

async function processMeetingTranscribeJob(
  job: Job<MeetingTranscribeJobPayload>,
) {
  const payload = job.data;
  const { meetingId, tenantId, userId, audioStorageKey, mimeType, durationMs } = payload;

  console.log(`[meeting-transcribe] Processing meeting ${meetingId}`);
  const { llmCompletion, meetings, realtime, creditLedger, tokenCreditCharge, usageRecorder } = await getWorkerServices();

  const meeting = await prisma.meeting.findFirst({
    where: { id: meetingId, tenantId },
    include: {
      transcripts: {
        where: { source: { in: ['whisper-1', 'deepgram-stream'] } },
      },
    },
  });
  if (!meeting) {
    console.error(`[meeting-transcribe] Meeting ${meetingId} not found — skipping`);
    return;
  }

  const whisperTranscript = (meeting.transcripts as Array<{ source: string; content: string }>)
    .find((t) => t.source === 'whisper-1');
  const deepgramTranscript = (meeting.transcripts as Array<{ source: string; content: string }>)
    .find((t) => t.source === 'deepgram-stream');

  if (whisperTranscript) {
    if (meeting.status !== 'ready') {
      await prisma.meeting.update({ where: { id: meetingId }, data: { status: 'ready' } });
    }
    console.log(`[meeting-transcribe] Meeting ${meetingId} already transcribed (whisper-1) — skipping`);
    return;
  }

  try {
    let transcriptText: string;

    if (deepgramTranscript) {
      // Deepgram live streaming already produced a transcript — skip Whisper to avoid double billing.
      console.log(`[meeting-transcribe] Using deepgram-stream transcript for ${meetingId} — skipping Whisper`);
      const parsed = JSON.parse(deepgramTranscript.content) as { text?: string };
      transcriptText = parsed.text ?? '';
    } else {
      // No live transcript — run Whisper batch transcription as fallback.
      const audioBuffer = await meetings.loadAudioBuffer(audioStorageKey);

      const transcriptResult = await llmCompletion.transcribeAudio(audioBuffer, {
        lang: 'en',
        mimeType,
      });

      // Compute actual Whisper cost from real audio duration (segments give exact total).
      // Use segment-derived duration if available, otherwise fall back to job payload durationMs.
      const actualDurationMs = transcriptResult.segments.length > 0
        ? Math.round(Math.max(...transcriptResult.segments.map((s) => s.end)) * 1000)
        : (durationMs ?? 60_000);

      const whisperCostUsd = computeWhisperCostUsd(actualDurationMs);
      const billingPlan = await tokenCreditCharge.resolveBillingPlan(tenantId);
      const transcriptionCredits = tokenCreditCharge.computeCreditsFromProviderCost(
        whisperCostUsd,
        1,
        undefined,
        billingPlan,
      );

      // Store structured Whisper transcript
      await prisma.meetingTranscript.create({
        data: {
          tenantId,
          meetingId,
          content: JSON.stringify({ text: transcriptResult.text, segments: transcriptResult.segments }),
          source: 'whisper-1',
        },
      });

      // Debit transcription credits and log usage (best-effort)
      try {
        await creditLedger.assertAndDebit({
          tenantId,
          userId,
          taskType: AI_TASK_TYPES.MEETING_TRANSCRIPTION,
          credits: transcriptionCredits,
          metadata: { meetingId, durationMs: actualDurationMs, providerCostUsd: whisperCostUsd },
        });
        await usageRecorder.recordAfterFlatDebit({
          tenantId,
          userId,
          taskType: AI_TASK_TYPES.MEETING_TRANSCRIPTION,
          mode: 'AUTO',
          modelName: 'whisper-1',
          modelProvider: 'openai',
          credits: transcriptionCredits,
          costUsd: whisperCostUsd,
          metadata: { meetingId, durationMs: actualDurationMs },
        });
        console.log(`[meeting-transcribe] Debited ${transcriptionCredits} credits for Whisper transcription (${actualDurationMs}ms)`);
      } catch (creditErr) {
        console.warn(`[meeting-transcribe] Credit debit failed for transcription: ${String(creditErr)}`);
      }

      transcriptText = transcriptResult.text;
    }

    // Emit intermediate event: transcription complete, now generating notes
    try {
      realtime.publishToTenant(tenantId, REALTIME_EVENTS.MEETING_STATUS_UPDATED, {
        entityId: meetingId,
        action: 'processing',
        data: { meetingId, status: 'processing', stage: 'notes' },
      });
    } catch { /* non-fatal */ }
    const notesModel = 'gpt-4o-mini';

    // Generate structured meeting notes in a single LLM call
    let notesMarkdown = '';
    let notesInputTokens = 0;
    let notesOutputTokens = 0;
    try {
      const notesResult = await llmCompletion.complete({
        modelName: notesModel,
        messages: [
          {
            role: 'system',
            content: MEETING_NOTES_SYSTEM_PROMPT,
          },
          {
            role: 'user',
            content: buildMeetingNotesUserPrompt(meeting.title, transcriptText),
          },
        ],
        maxTokens: 1200,
        temperature: 0.2,
      });
      notesMarkdown = notesResult.content;
      notesInputTokens = notesResult.inputTokens;
      notesOutputTokens = notesResult.outputTokens;
    } catch {
      notesMarkdown = `## Summary\n- Transcript processed. Review for follow-up items.`;
    }

    await prisma.meetingNote.create({
      data: { tenantId, meetingId, content: notesMarkdown, createdById: userId },
    });

    // Debit notes credits based on actual token usage.
    if (notesInputTokens > 0 || notesOutputTokens > 0) {
      try {
        const notesBilling = await tokenCreditCharge.computeCreditsForUsage({
          modelName: notesModel,
          inputTokens: notesInputTokens,
          outputTokens: notesOutputTokens,
          taskType: AI_TASK_TYPES.MEETING_NOTES,
          tenantId,
        });
        await creditLedger.assertAndDebit({
          tenantId,
          userId,
          taskType: AI_TASK_TYPES.MEETING_NOTES,
          credits: notesBilling.credits,
          metadata: {
            meetingId,
            modelName: notesModel,
            inputTokens: notesInputTokens,
            outputTokens: notesOutputTokens,
            providerCostUsd: notesBilling.providerCostUsd,
          },
        });
        await usageRecorder.recordAfterFlatDebit({
          tenantId,
          userId,
          taskType: AI_TASK_TYPES.MEETING_NOTES,
          mode: 'AUTO',
          modelName: notesModel,
          modelProvider: 'openai',
          credits: notesBilling.credits,
          costUsd: notesBilling.providerCostUsd,
          inputTokens: notesInputTokens,
          outputTokens: notesOutputTokens,
          metadata: { meetingId },
        });
        console.log(`[meeting-transcribe] Debited ${notesBilling.credits} credits for notes (${notesInputTokens}in/${notesOutputTokens}out tokens)`);
      } catch (creditErr) {
        console.warn(`[meeting-transcribe] Credit debit failed for notes: ${String(creditErr)}`);
      }
    }

    await prisma.meeting.update({
      where: { id: meetingId },
      data: { status: 'ready' },
    });

    // Push realtime notification so the meeting detail page refreshes immediately
    try {
      realtime.publishToTenant(tenantId, REALTIME_EVENTS.MEETING_STATUS_UPDATED, {
        entityId: meetingId,
        action: 'ready',
        data: { meetingId, status: 'ready' },
      });
    } catch (err) {
      console.warn('[meeting-transcribe] Could not publish realtime event', err);
    }

    console.log(`[meeting-transcribe] Meeting ${meetingId} complete`);
  } catch (err) {
    await prisma.meeting.update({
      where: { id: meetingId },
      data: { status: 'failed' },
    });
    throw err;
  }
}

export function createSummaryWorker() {
  return new Worker(
    QUEUE_NAMES.AI_LOW,
    async (job: Job) => {
      if (job.name === AI_JOB_TYPES.MEETING_TRANSCRIBE) {
        await processMeetingTranscribeJob(job as Job<MeetingTranscribeJobPayload>);
      } else {
        await processSummaryJob(job as Job<AiAgentJobPayload>);
      }
    },
    {
      connection: getRedisConnectionOptions(),
      concurrency: 3,
    },
  );
}
