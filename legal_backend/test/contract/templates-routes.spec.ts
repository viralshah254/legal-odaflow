import * as fs from 'fs';
import * as path from 'path';

const CONTROLLER_PATH = path.resolve(
  __dirname,
  '../../src/templates/templates.controller.ts',
);

describe('Templates route ordering', () => {
  it('registers static library routes before GET :templateId', () => {
    const source = fs.readFileSync(CONTROLLER_PATH, 'utf8');
    const libraryIndex = source.indexOf("@Get('library')");
    const paramIndex = source.indexOf("@Get(':templateId')");
    expect(libraryIndex).toBeGreaterThan(-1);
    expect(paramIndex).toBeGreaterThan(-1);
    expect(libraryIndex).toBeLessThan(paramIndex);
  });
});
