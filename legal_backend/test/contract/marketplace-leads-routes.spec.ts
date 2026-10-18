import * as fs from 'fs';
import * as path from 'path';

const CONTROLLER_PATH = path.resolve(
  __dirname,
  '../../src/marketplace/marketplace.controller.ts',
);

describe('Marketplace leads route ordering', () => {
  it('registers GET leads/pipeline before GET leads/:leadId', () => {
    const source = fs.readFileSync(CONTROLLER_PATH, 'utf8');
    const pipelineIndex = source.indexOf("@Get('leads/pipeline')");
    const paramIndex = source.indexOf("@Get('leads/:leadId')");
    expect(pipelineIndex).toBeGreaterThan(-1);
    expect(paramIndex).toBeGreaterThan(-1);
    expect(pipelineIndex).toBeLessThan(paramIndex);
  });
});
