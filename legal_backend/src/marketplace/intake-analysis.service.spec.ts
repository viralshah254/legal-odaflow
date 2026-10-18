import { readFileSync } from 'fs';
import { join } from 'path';

describe('IntakeAnalysisService worker dependency wiring', () => {
  it('declares AiGatewayService as a forward reference', () => {
    const source = readFileSync(
      join(__dirname, 'intake-analysis.service.ts'),
      'utf8',
    );

    expect(source).toContain("import {\n  ForbiddenException,\n  forwardRef,\n  Inject,");
    expect(source).toMatch(
      /@Inject\(forwardRef\(\(\) => AiGatewayService\)\)\s+private readonly aiGateway: AiGatewayService/,
    );
  });
});
