export type CopilotToolName =
  | 'create_task'
  | 'summarize_matter'
  | 'legal_research_memo'
  | 'draft_document'
  | 'suggest_next_steps';

export interface CopilotActionProposal {
  id: string;
  label: string;
  description: string;
  toolName: CopilotToolName;
  payload: Record<string, unknown>;
  affectedRecords: { type: string; id: string; label: string }[];
  reasoning?: string;
  requiresApproval: boolean;
  status: 'proposed' | 'approved' | 'rejected' | 'executed' | 'failed';
  jobId?: string;
}

export interface CopilotToolCallRecord {
  id: string;
  toolName: CopilotToolName;
  args: Record<string, unknown>;
  status: 'pending' | 'success' | 'error';
  jobId?: string;
  result?: unknown;
  error?: string;
}

export interface CopilotChatResponse {
  sessionId: string;
  message: {
    id: string;
    sessionId: string;
    role: string;
    content: string;
    toolCalls?: CopilotToolCallRecord[];
    citations?: unknown;
    createdAt: Date;
  };
  actionProposals: CopilotActionProposal[];
  asyncJobs?: Array<{ toolName: CopilotToolName; jobId: string }>;
  modelMode?: 'AUTO' | 'PREMIUM';
  modelName?: string;
  premiumFallback?: boolean;
  creditsCharged?: number;
}
