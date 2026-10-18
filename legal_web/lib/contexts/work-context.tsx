"use client";

/**
 * ResolvedWorkContext — single source of truth for the current work session.
 *
 * B04 fix: matterId is no longer sourced from the URL.  All components that
 * need clientId/matterId must call useMatter() (or useResolvedWorkContext())
 * instead of useSearchParams().
 *
 * B05 fix: every call to startWorkContext now includes a UUID operationRequestKey
 * generated at submit time so that network retries are idempotent.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useState,
} from "react";
import { startWorkContext, type StartWorkResult } from "@/lib/api/work-context";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ResolvedWorkContext = {
  /** Canonical scope key from the backend */
  scopeKey: string;
  standalone: boolean;
  clientId: string | null;
  matterId: string | null;
  /** UI-only display label */
  clientName?: string;
  /** ISO country code for this work context */
  countryCode: string;
};

type WorkContextState = {
  resolved: ResolvedWorkContext | null;
  loading: boolean;
  error: string | null;
};

type WorkContextActions = {
  /**
   * Start a new work context.  Generates a fresh operationRequestKey per call
   * so network retries are idempotent without creating duplicate records.
   */
  startWork: (params: StartWorkParams) => Promise<ResolvedWorkContext>;
  /** Manually set the active context (e.g. when navigating to an existing matter). */
  setResolved: (ctx: ResolvedWorkContext) => void;
  /** Clear the active context (e.g. on sign-out). */
  clear: () => void;
};

export type StartWorkParams = {
  mode: "existing_client" | "new_client" | "unassigned";
  clientId?: string;
  matterId?: string;
  clientName?: string;
  countryCode?: string;
  createClient?: {
    name: string;
    email?: string;
    phone?: string;
    countryCode?: string;
  };
  createMatter?: {
    title: string;
    jurisdiction?: string;
    matterType?: string;
    countryCode?: string;
  };
};

type WorkContextValue = WorkContextState & WorkContextActions;

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const WorkContextCtx = createContext<WorkContextValue | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function ResolvedWorkContextProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [state, setState] = useState<WorkContextState>({
    resolved: null,
    loading: false,
    error: null,
  });

  const startWork = useCallback(
    async (params: StartWorkParams): Promise<ResolvedWorkContext> => {
      setState((s) => ({ ...s, loading: true, error: null }));

      // B05 fix: generate a fresh operationRequestKey per submit.
      // This makes network retries idempotent without creating duplicate records.
      // crypto.randomUUID() is available in all modern browsers and Node 14.17+.
      const operationRequestKey =
        typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : Math.random().toString(36).slice(2) + Date.now().toString(36);
      const countryCode = params.countryCode ?? "IN";

      let result: StartWorkResult;
      try {
        result = await startWorkContext({
          mode: params.mode,
          clientId: params.clientId,
          matterId: params.matterId,
          operationRequestKey,
          countryCode,
          createClient: params.createClient
            ? {
                ...params.createClient,
                countryCode: params.createClient.countryCode ?? countryCode,
              }
            : undefined,
          createMatter: params.createMatter
            ? {
                ...params.createMatter,
                countryCode: params.createMatter.countryCode ?? countryCode,
              }
            : undefined,
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Could not start work";
        setState((s) => ({ ...s, loading: false, error: msg }));
        throw e;
      }

      const resolved: ResolvedWorkContext = {
        scopeKey: result.scopeKey,
        standalone: result.standalone,
        clientId: result.clientId,
        matterId: result.matterId,
        clientName: params.clientName,
        countryCode,
      };
      setState({ resolved, loading: false, error: null });
      return resolved;
    },
    [],
  );

  const setResolved = useCallback((ctx: ResolvedWorkContext) => {
    setState({ resolved: ctx, loading: false, error: null });
  }, []);

  const clear = useCallback(() => {
    setState({ resolved: null, loading: false, error: null });
  }, []);

  return (
    <WorkContextCtx.Provider
      value={{ ...state, startWork, setResolved, clear }}
    >
      {children}
    </WorkContextCtx.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

/**
 * Returns the full resolved work context value.
 * Throws if called outside a ResolvedWorkContextProvider.
 */
export function useResolvedWorkContext(): WorkContextValue {
  const ctx = useContext(WorkContextCtx);
  if (!ctx) {
    throw new Error(
      "useResolvedWorkContext must be used inside ResolvedWorkContextProvider",
    );
  }
  return ctx;
}

/**
 * Convenience hook — returns { matterId, clientId, countryCode } from the
 * resolved context.  Returns nulls when no context is set.
 *
 * B04 fix: replaces useSearchParams()-based matterId reads.
 */
export function useMatter(): {
  matterId: string | null;
  clientId: string | null;
  countryCode: string;
  scopeKey: string | null;
} {
  const ctx = useContext(WorkContextCtx);
  return {
    matterId: ctx?.resolved?.matterId ?? null,
    clientId: ctx?.resolved?.clientId ?? null,
    countryCode: ctx?.resolved?.countryCode ?? "IN",
    scopeKey: ctx?.resolved?.scopeKey ?? null,
  };
}
