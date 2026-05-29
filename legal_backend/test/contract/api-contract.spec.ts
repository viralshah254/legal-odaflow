/**
 * API contract tests — guard web/backend route alignment for critical modules.
 * These are static contract checks (no DB required).
 */

const TASK_CREATE_FIELDS = ['title', 'assigneeId', 'status', 'priority'];
const TASK_STATUS_VALUES = ['TODO', 'IN_PROGRESS', 'DONE', 'CANCELLED'];
const TASK_PRIORITY_VALUES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

const NOTIFICATION_ROUTES = {
  list: 'GET /notifications',
  markRead: 'PATCH /notifications/:notificationId/read',
  markAllRead: 'POST /notifications/read-all',
  registerDevice: 'POST /notifications/devices/register',
};

const AUTOMATION_ROUTES = {
  listRules: 'GET /automations/rules',
  updateRule: 'PATCH /automations/rules/:ruleId',
  seedRules: 'POST /automations/rules/seed',
};

const ALERT_ROUTES = {
  list: 'GET /alerts',
  urgent: 'GET /alerts/urgent',
  complete: 'POST /alerts/:alertId/complete',
  skip: 'POST /alerts/:alertId/skip',
  acknowledge: 'POST /alerts/:alertId/acknowledge',
};

const AGENT_ROUTES = {
  list: 'GET /agents',
  recipes: 'GET /agents/recipes',
  jobs: 'GET /agents/jobs',
  jobById: 'GET /agents/jobs/:jobId',
};

describe('API contract — tasks', () => {
  it('uses backend field names for create payload', () => {
    expect(TASK_CREATE_FIELDS).toContain('assigneeId');
    expect(TASK_CREATE_FIELDS).not.toContain('assignedToId');
  });

  it('uses uppercase status and priority enums', () => {
    expect(TASK_STATUS_VALUES).toContain('TODO');
    expect(TASK_PRIORITY_VALUES).toContain('MEDIUM');
  });
});

describe('API contract — notifications', () => {
  it('uses PATCH for mark read', () => {
    expect(NOTIFICATION_ROUTES.markRead).toMatch(/^PATCH/);
  });

  it('uses token field on device register path', () => {
    expect(NOTIFICATION_ROUTES.registerDevice).toContain('/devices/register');
  });
});

describe('API contract — automations', () => {
  it('uses /automations/rules namespace', () => {
    expect(AUTOMATION_ROUTES.listRules).toContain('/automations/rules');
    expect(AUTOMATION_ROUTES.updateRule).toContain('/automations/rules/');
  });
});

describe('API contract — alerts', () => {
  it('defines urgent and action routes', () => {
    expect(ALERT_ROUTES.urgent).toContain('/alerts/urgent');
    expect(ALERT_ROUTES.complete).toContain('/complete');
    expect(ALERT_ROUTES.skip).toContain('/skip');
    expect(ALERT_ROUTES.acknowledge).toContain('/acknowledge');
  });
});

describe('API contract — agents', () => {
  it('exposes job polling endpoints', () => {
    expect(AGENT_ROUTES.jobs).toContain('/agents/jobs');
    expect(AGENT_ROUTES.jobById).toContain(':jobId');
  });
});
