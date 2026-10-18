import { Injectable } from '@nestjs/common';

interface PresenceEntry {
  userId: string
  userType: string | null
  countryCode: string | null
  connectedAt: Date
  lastSeenAt: Date
}

interface TodaySessionEntry {
  completedSeconds: number
  lastDisconnectedAt: Date | null
}

export interface PresenceUserSnapshot {
  userId: string
  userType: string | null
  countryCode: string | null
  isOnline: boolean
  connectedAt: string | null
  sessionSeconds: number
}

@Injectable()
export class PresenceService {
  private readonly store = new Map<string, PresenceEntry>();
  /** Completed session seconds per user for the current calendar day (in-memory; lost on restart). */
  private readonly todaySessions = new Map<string, TodaySessionEntry>();
  private todayDateKey = this.getTodayKey();
  private readonly STALE_MS = 5 * 60 * 1_000; // 5 minutes

  upsert(userId: string, meta: { userType?: string | null; countryCode?: string | null }) {
    this.ensureToday();
    const existing = this.store.get(userId);
    this.store.set(userId, {
      userId,
      userType: meta.userType ?? existing?.userType ?? null,
      countryCode: meta.countryCode ?? existing?.countryCode ?? null,
      connectedAt: existing?.connectedAt ?? new Date(),
      lastSeenAt: new Date(),
    });
  }

  remove(userId: string) {
    this.ensureToday();
    const entry = this.store.get(userId);
    if (entry) {
      this.recordCompletedSession(userId, entry.connectedAt);
    }
    this.store.delete(userId);
  }

  flushStale() {
    this.ensureToday();
    const threshold = Date.now() - this.STALE_MS;
    for (const [id, entry] of this.store.entries()) {
      if (entry.lastSeenAt.getTime() < threshold) {
        this.recordCompletedSession(id, entry.connectedAt);
        this.store.delete(id);
      }
    }
  }

  getPresenceSnapshot() {
    this.flushStale();
    this.ensureToday();
    const entries = Array.from(this.store.values());
    const now = Date.now();

    const byCountry: Record<string, number> = {};
    const byUserType: Record<string, number> = {};
    for (const e of entries) {
      const cc = e.countryCode ?? 'unknown';
      byCountry[cc] = (byCountry[cc] ?? 0) + 1;
      const ut = e.userType ?? 'unknown';
      byUserType[ut] = (byUserType[ut] ?? 0) + 1;
    }

    const userIds = new Set<string>();
    for (const e of entries) {
      userIds.add(e.userId);
    }
    for (const userId of this.todaySessions.keys()) {
      userIds.add(userId);
    }

    const users: PresenceUserSnapshot[] = Array.from(userIds)
      .map((userId) => {
        const live = this.store.get(userId);
        const today = this.todaySessions.get(userId);
        const completedSeconds = today?.completedSeconds ?? 0;

        if (live) {
          const currentSeconds = Math.max(
            0,
            Math.floor((now - live.connectedAt.getTime()) / 1000),
          );
          return {
            userId,
            userType: live.userType,
            countryCode: live.countryCode,
            isOnline: true,
            connectedAt: live.connectedAt.toISOString(),
            sessionSeconds: completedSeconds + currentSeconds,
          };
        }

        return {
          userId,
          userType: null,
          countryCode: null,
          isOnline: false,
          connectedAt: null,
          sessionSeconds: completedSeconds,
        };
      })
      .filter((u) => u.isOnline || u.sessionSeconds > 0)
      .sort((a, b) => {
        if (a.isOnline !== b.isOnline) return a.isOnline ? -1 : 1;
        return b.sessionSeconds - a.sessionSeconds;
      });

    return {
      onlineCount: entries.length,
      byCountry,
      byUserType,
      users,
    };
  }

  private getTodayKey(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private ensureToday() {
    const key = this.getTodayKey();
    if (key !== this.todayDateKey) {
      this.todayDateKey = key;
      this.todaySessions.clear();
    }
  }

  private recordCompletedSession(userId: string, connectedAt: Date) {
    const durationSec = Math.max(
      0,
      Math.floor((Date.now() - connectedAt.getTime()) / 1000),
    );
    const existing = this.todaySessions.get(userId);
    this.todaySessions.set(userId, {
      completedSeconds: (existing?.completedSeconds ?? 0) + durationSec,
      lastDisconnectedAt: new Date(),
    });
  }
}
