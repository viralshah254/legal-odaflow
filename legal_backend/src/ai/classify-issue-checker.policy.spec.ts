import { ServiceUnavailableException } from '@nestjs/common';
import {
  FIRM_INTAKE_CLASSIFY_FAILED,
  FIRM_INTAKE_CLASSIFY_UNCONFIGURED,
  runClassifyWithFailClosed,
} from './classify-issue-checker.policy';

describe('runClassifyWithFailClosed', () => {
  const keyword = () => ({ source: 'keywords' });
  const llm = () => Promise.resolve({ source: 'llm' });

  it('fails closed on FIRM_INTAKE when the model is unconfigured', async () => {
    await expect(
      runClassifyWithFailClosed({
        mode: 'FIRM_INTAKE',
        isConfigured: false,
        classify: llm,
        keywordFallback: keyword,
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);

    await expect(
      runClassifyWithFailClosed({
        mode: 'FIRM_INTAKE',
        isConfigured: false,
        classify: llm,
        keywordFallback: keyword,
      }),
    ).rejects.toThrow(FIRM_INTAKE_CLASSIFY_UNCONFIGURED);
  });

  it('fails closed on FIRM_INTAKE when the model throws — no keyword fallback', async () => {
    const keywordFallback = jest.fn(() => ({ source: 'keywords' }));
    await expect(
      runClassifyWithFailClosed({
        mode: 'FIRM_INTAKE',
        isConfigured: true,
        classify: () => Promise.reject(new Error('model down')),
        keywordFallback,
      }),
    ).rejects.toThrow(FIRM_INTAKE_CLASSIFY_FAILED);
    expect(keywordFallback).not.toHaveBeenCalled();
  });

  it('uses keyword fallback for anonymous / SELF teaser when the model fails', async () => {
    const result = await runClassifyWithFailClosed({
      mode: 'SELF',
      isConfigured: true,
      classify: () => Promise.reject(new Error('model down')),
      keywordFallback: keyword,
    });
    expect(result).toEqual({ source: 'keywords' });
  });
});
