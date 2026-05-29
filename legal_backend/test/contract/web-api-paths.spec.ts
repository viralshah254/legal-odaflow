import * as fs from 'fs';
import * as path from 'path';

const WEB_ROOT = path.resolve(__dirname, '../../../legal_web');

function readWebApi(relativePath: string): string {
  return fs.readFileSync(path.join(WEB_ROOT, relativePath), 'utf8');
}

describe('Web API client paths', () => {
  it('notifications client uses PATCH read route', () => {
    const source = readWebApi('lib/api/notifications.ts');
    expect(source).toContain("method: \"PATCH\"");
    expect(source).toContain('/notifications/${notificationId}/read');
  });

  it('automations client uses /automations/rules', () => {
    const source = readWebApi('lib/api/automations.ts');
    expect(source).toContain('/automations/rules');
  });

  it('tasks client maps assigneeId', () => {
    const source = readWebApi('lib/api/tasks.ts');
    expect(source).toContain('assigneeId');
  });

  it('payments client uses /payments/intent', () => {
    const source = readWebApi('lib/api/payments.ts');
    expect(source).toContain('/payments/intent');
  });

  it('ai client uses command center summary route', () => {
    const source = readWebApi('lib/api/ai.ts');
    expect(source).toContain('/ai/command-center/summary');
  });

  it('consumer case workspace client uses drafts/messages/payments routes', () => {
    const source = readWebApi('lib/api/consumer-case-workspace.ts');
    expect(source).toContain('/consumers/cases/${caseId}/drafts');
    expect(source).toContain('/consumers/cases/${caseId}/messages');
    expect(source).toContain('/consumers/cases/${caseId}/payments');
  });
});
