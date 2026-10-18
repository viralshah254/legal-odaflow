import { ServiceUnavailableException } from '@nestjs/common';

export const FIRM_INTAKE_CLASSIFY_UNCONFIGURED =
  'AI classification is required for firm intake and is not configured.';

export const FIRM_INTAKE_CLASSIFY_FAILED =
  'Firm intake classification failed. Retry after the model is available — keyword fallback is not used for partner intake.';

export function isFirmIntakeClassify(mode?: string): boolean {
  return mode === 'FIRM_INTAKE';
}

export async function runClassifyWithFailClosed<T>(opts: {
  mode?: string;
  isConfigured: boolean;
  classify: () => Promise<T>;
  keywordFallback: () => T;
}): Promise<T> {
  const failClosed = isFirmIntakeClassify(opts.mode);

  if (failClosed && !opts.isConfigured) {
    throw new ServiceUnavailableException(FIRM_INTAKE_CLASSIFY_UNCONFIGURED);
  }

  if (opts.isConfigured) {
    try {
      return await opts.classify();
    } catch (err) {
      if (failClosed) {
        if (err instanceof ServiceUnavailableException) throw err;
        throw new ServiceUnavailableException(FIRM_INTAKE_CLASSIFY_FAILED);
      }
    }
  }

  return opts.keywordFallback();
}
