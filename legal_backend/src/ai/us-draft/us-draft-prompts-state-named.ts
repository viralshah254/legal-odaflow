/** Aggregated Tier-3 state-specific named form prompts (auto-generated). */
import { CA_NAMED_PROMPTS } from './us-draft-prompts-state-specific/ca';
import { NY_NAMED_PROMPTS } from './us-draft-prompts-state-specific/ny';
import { TX_NAMED_PROMPTS } from './us-draft-prompts-state-specific/tx';
import { FL_NAMED_PROMPTS } from './us-draft-prompts-state-specific/fl';
import { IL_NAMED_PROMPTS } from './us-draft-prompts-state-specific/il';

export const US_STATE_NAMED_PROMPTS: Record<string, string> = {
  ...CA_NAMED_PROMPTS,
  ...NY_NAMED_PROMPTS,
  ...TX_NAMED_PROMPTS,
  ...FL_NAMED_PROMPTS,
  ...IL_NAMED_PROMPTS,
};

export const US_STATE_NAMED_DRAFT_KINDS = Object.keys(US_STATE_NAMED_PROMPTS);

/** Maps kind id → required state code */
export const US_STATE_NAMED_BOUND_STATE: Record<string, string> = Object.fromEntries(
  US_STATE_NAMED_DRAFT_KINDS.map((kind) => {
    const m = kind.match(/^us_(ca|ny|tx|fl|il)_/);
    return [kind, (m?.[1] ?? '').toUpperCase()];
  }),
);
