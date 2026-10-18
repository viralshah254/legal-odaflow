import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DeepgramClient,
  ListenV1Encoding,
  ListenV1InterimResults,
  ListenV1Model,
  ListenV1Punctuate,
  ListenV1SmartFormat,
  type Deepgram,
} from '@deepgram/sdk';
import type { V1Socket } from '@deepgram/sdk/listen/v1';
import { PrismaService } from '@/prisma/prisma.service';
import { AICreditLedgerService } from '@/ai-credits/ai-credit-ledger.service';
import { TokenCreditChargeService } from '@/ai-credits/token-credit-charge.service';
import { AiUsageRecorderService } from '@/ai/ai-usage-recorder.service';
import { AI_TASK_TYPES } from '@/ai-credits/task-types';

export interface TranscriptSegment {
  text: string;
  startMs: number;
  endMs: number;
  isFinal: boolean;
}

interface StreamingSession {
  tenantId: string;
  meetingId: string;
  userId: string;
  socket: V1Socket;
  segments: TranscriptSegment[];
  startedAt: Date;
  finalText: string;
  finalDurationMs: number;
}

/**
 * Manages per-meeting Deepgram real-time streaming sessions.
 *
 * Audio format expected: 16 kHz mono, linear16 PCM (raw 16-bit LE samples).
 * The frontend captures this via ScriptProcessorNode and sends binary frames over Socket.io.
 *
 * Uses Deepgram SDK v5 API: client.listen.v1.connect(args) → V1Socket
 */
@Injectable()
export class MeetingStreamingTranscriptionService {
  private readonly logger = new Logger(MeetingStreamingTranscriptionService.name);
  private readonly sessions = new Map<string, StreamingSession>();
  private deepgramClient: DeepgramClient | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly creditLedger: AICreditLedgerService,
    private readonly tokenCreditCharge: TokenCreditChargeService,
    private readonly usageRecorder: AiUsageRecorderService,
  ) {
    const apiKey = this.config.get<string>('DEEPGRAM_API_KEY', '').trim();
    if (apiKey) {
      this.deepgramClient = new DeepgramClient({ apiKey });
      this.logger.log('Deepgram client initialised (SDK v5)');
    } else {
      this.logger.warn('DEEPGRAM_API_KEY not set — live streaming STT disabled; falling back to Web Speech + Whisper');
    }
  }

  isAvailable(): boolean {
    return this.deepgramClient !== null;
  }

  private sessionKey(tenantId: string, meetingId: string): string {
    return `${tenantId}:${meetingId}`;
  }

  /**
   * Open a Deepgram streaming session for a meeting.
   * Returns false if Deepgram is not configured.
   * Calls onResult for each transcript event (partial or final).
   */
  async startSession(
    tenantId: string,
    meetingId: string,
    userId: string,
    onResult: (segment: TranscriptSegment) => void,
    onError: (message: string) => void,
  ): Promise<boolean> {
    if (!this.deepgramClient) return false;

    const key = this.sessionKey(tenantId, meetingId);
    if (this.sessions.has(key)) {
      this.logger.warn(`Session already active for ${key}`);
      return true;
    }

    let socket: V1Socket;
    try {
      socket = await this.deepgramClient.listen.v1.connect({
        Authorization: this.config.get<string>('DEEPGRAM_API_KEY', ''),
        model: ListenV1Model.Nova3,
        language: 'en',
        encoding: ListenV1Encoding.Linear16,
        sample_rate: 16000,
        channels: 1,
        interim_results: ListenV1InterimResults.True,
        punctuate: ListenV1Punctuate.True,
        smart_format: ListenV1SmartFormat.True,
        utterance_end_ms: 1000,
      });
    } catch (err) {
      this.logger.error(`Failed to open Deepgram session for ${key}: ${String(err)}`);
      return false;
    }

    const session: StreamingSession = {
      tenantId,
      meetingId,
      userId,
      socket,
      segments: [],
      startedAt: new Date(),
      finalText: '',
      finalDurationMs: 0,
    };

    socket.on('open', () => {
      this.logger.debug(`Deepgram open: ${key}`);
    });

    socket.on('message', (data) => {
      if (data.type !== 'Results') return;
      const result = data as Deepgram.listen.ListenV1Results;
      const alt = result.channel?.alternatives?.[0];
      if (!alt?.transcript) return;

      const isFinal = result.is_final === true;
      const startMs = Math.round((result.start ?? 0) * 1000);
      const endMs = Math.round(((result.start ?? 0) + (result.duration ?? 0)) * 1000);
      const segment: TranscriptSegment = { text: alt.transcript, startMs, endMs, isFinal };

      if (isFinal) {
        session.segments.push(segment);
        session.finalText = (session.finalText + ' ' + alt.transcript).trim();
        session.finalDurationMs = Math.max(session.finalDurationMs, endMs);
      }

      onResult(segment);
    });

    socket.on('error', (err) => {
      this.logger.error(`Deepgram error for ${key}: ${String(err)}`);
      onError('Live transcription encountered an error. Audio is still recording.');
    });

    socket.on('close', () => {
      this.logger.debug(`Deepgram closed: ${key}`);
    });

    try {
      socket.connect();
      await socket.waitForOpen();
    } catch (err) {
      this.logger.error(`Deepgram websocket failed for ${key}: ${String(err)}`);
      return false;
    }

    this.sessions.set(key, session);
    return true;
  }

  /** Forward a raw PCM audio chunk to the open Deepgram session. */
  sendAudio(tenantId: string, meetingId: string, chunk: Buffer): void {
    const session = this.sessions.get(this.sessionKey(tenantId, meetingId));
    if (!session) return;
    try {
      session.socket.sendMedia(chunk);
    } catch {
      // Connection may be closing; ignore
    }
  }

  /**
   * Close the streaming session, persist the transcript draft, and debit credits.
   * Returns the accumulated final text (empty string if no session).
   */
  async stopSession(tenantId: string, meetingId: string): Promise<{ finalText: string; durationMs: number }> {
    const key = this.sessionKey(tenantId, meetingId);
    const session = this.sessions.get(key);
    if (!session) return { finalText: '', durationMs: 0 };

    this.sessions.delete(key);

    try {
      session.socket.sendFinalize({ type: 'Finalize' });
      session.socket.close();
    } catch {
      // Already closed
    }

    const { finalText, finalDurationMs, segments, userId } = session;

    if (finalText.trim() && segments.length > 0) {
      try {
        // Use createOrUpdate pattern — upsert on meetingId + source unique compound
        const existing = await this.prisma.meetingTranscript.findFirst({
          where: { meetingId, source: 'deepgram-stream' } as never,
        });
        if (existing) {
          await this.prisma.meetingTranscript.update({
            where: { id: (existing as { id: string }).id },
            data: {
              content: JSON.stringify({
                text: finalText,
                segments: segments.map((s) => ({
                  id: 0,
                  start: s.startMs / 1000,
                  end: s.endMs / 1000,
                  text: s.text,
                })),
              }),
            },
          });
        } else {
          await this.prisma.meetingTranscript.create({
            data: {
              tenantId,
              meetingId,
              source: 'deepgram-stream',
              content: JSON.stringify({
                text: finalText,
                segments: segments.map((s) => ({
                  id: 0,
                  start: s.startMs / 1000,
                  end: s.endMs / 1000,
                  text: s.text,
                })),
              }),
            } as never,
          });
        }
      } catch (err) {
        this.logger.warn(`Failed to save deepgram-stream transcript for ${meetingId}: ${String(err)}`);
      }

      // Debit credits for live streaming duration
      try {
        const providerCostUsd = computeDeepgramStreamingCostUsd(finalDurationMs);
        const billingPlan = await this.tokenCreditCharge.resolveBillingPlan(tenantId);
        const credits = this.tokenCreditCharge.computeCreditsFromProviderCost(
          providerCostUsd,
          1,
          undefined,
          billingPlan,
        );
        await this.creditLedger.assertAndDebit({
          tenantId,
          userId,
          taskType: AI_TASK_TYPES.MEETING_LIVE_TRANSCRIPTION,
          credits,
          metadata: { meetingId, durationMs: finalDurationMs, providerCostUsd },
        });
        await this.usageRecorder.recordAfterFlatDebit({
          tenantId,
          userId,
          taskType: AI_TASK_TYPES.MEETING_LIVE_TRANSCRIPTION,
          mode: 'AUTO',
          modelName: 'deepgram-nova-3',
          modelProvider: 'deepgram',
          credits,
          costUsd: providerCostUsd,
          metadata: { meetingId, durationMs: finalDurationMs },
        });
        this.logger.log(`[live-transcription] Debited ${credits} credits for ${Math.round(finalDurationMs / 1000)}s (meeting ${meetingId})`);
      } catch (err) {
        this.logger.warn(`[live-transcription] Credit debit failed: ${String(err)}`);
      }
    }

    return { finalText, durationMs: finalDurationMs };
  }

  /** Check whether a session is currently active. */
  hasSession(tenantId: string, meetingId: string): boolean {
    return this.sessions.has(this.sessionKey(tenantId, meetingId));
  }

  /** Emergency cleanup — abort session without persisting (e.g. on disconnect). */
  abortSession(tenantId: string, meetingId: string): void {
    const key = this.sessionKey(tenantId, meetingId);
    const session = this.sessions.get(key);
    if (!session) return;
    this.sessions.delete(key);
    try {
      session.socket.close();
    } catch {
      // Already closed
    }
  }
}

/**
 * Deepgram Nova-3 Pay-As-You-Go streaming cost.
 * ~$0.0077/min, billed per second (not rounded to full minutes).
 */
export function computeDeepgramStreamingCostUsd(durationMs: number): number {
  const durationSeconds = Math.max(1, Math.ceil(durationMs / 1000));
  return (durationSeconds / 60) * 0.0077;
}
