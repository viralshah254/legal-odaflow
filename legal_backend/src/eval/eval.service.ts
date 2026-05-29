import { Injectable } from '@nestjs/common';
import { EvalSuiteRunner, EvalSuiteResult } from './eval-suite.runner';

@Injectable()
export class EvalService {
  private readonly runHistory: EvalSuiteResult[] = [];

  constructor(private readonly runner: EvalSuiteRunner) {}

  async runSuite(): Promise<EvalSuiteResult> {
    const result = await this.runner.runFullSuite();
    this.runHistory.unshift(result);
    if (this.runHistory.length > 20) {
      this.runHistory.pop();
    }
    return result;
  }

  listRuns(): EvalSuiteResult[] {
    return this.runHistory;
  }

  getRun(runId: string): EvalSuiteResult | undefined {
    return this.runHistory.find((r) => r.runId === runId);
  }
}
