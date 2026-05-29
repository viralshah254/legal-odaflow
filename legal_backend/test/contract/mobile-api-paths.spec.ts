import * as fs from 'fs';
import * as path from 'path';

const APP_ROOT = path.resolve(__dirname, '../../../legal_app');

function readAppApi(relativePath: string): string {
  return fs.readFileSync(path.join(APP_ROOT, relativePath), 'utf8');
}

describe('Mobile API client paths', () => {
  it('marketplace client supports lead accept/reject/convert', () => {
    const source = readAppApi('lib/core/network/marketplace_api.dart');
    expect(source).toContain("/marketplace/leads/");
    expect(source).toContain("/accept");
    expect(source).toContain("/reject");
    expect(source).toContain("/convert");
  });

  it('subscriptions client uses checkout endpoint', () => {
    const source = readAppApi('lib/core/network/subscriptions_api.dart');
    expect(source).toContain('/subscriptions/checkout');
    expect(source).toContain('/pricing/plans');
  });

  it('payments client uses /payments/intent', () => {
    const source = readAppApi('lib/core/network/payments_api.dart');
    expect(source).toContain('/payments/intent');
  });

  it('consumers client uses full report endpoint', () => {
    const source = readAppApi('lib/core/network/consumers_api.dart');
    expect(source).toContain('/consumer-cases/');
    expect(source).toContain('/reports/full');
  });

  it('copilot client uses /ai/copilot/chat', () => {
    const source = readAppApi('lib/core/network/copilot_api.dart');
    expect(source).toContain('/ai/copilot/chat');
    expect(source).toContain('X-Tenant-Id');
  });
});
