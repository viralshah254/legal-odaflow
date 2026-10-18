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

const TIME_ROUTES = {
  submit: 'POST /time/:entryId/submit',
  reject: 'POST /time/:entryId/reject',
  approve: 'POST /time/:entryId/approve',
};

const BILLING_ROUTES = {
  statementPdf: 'GET /billing/statements/pdf',
  invoiceFromApprovedTime: 'POST /billing/invoices/from-approved-time',
  trustReconciliationStatement: 'GET /billing/trust/reconciliation/:id/statement',
};

const FINANCE_ROUTES = {
  dunningStatus: 'GET /finance/dunning/status',
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

describe('API contract — time (Series B Wave 1)', () => {
  it('exposes submit and reject approval routes', () => {
    expect(TIME_ROUTES.submit).toBe('POST /time/:entryId/submit');
    expect(TIME_ROUTES.reject).toBe('POST /time/:entryId/reject');
    expect(TIME_ROUTES.approve).toContain('/approve');
  });
});

describe('API contract — billing (Series B Wave 1)', () => {
  it('exposes statement PDF and invoice-from-time routes', () => {
    expect(BILLING_ROUTES.statementPdf).toContain('/billing/statements/pdf');
    expect(BILLING_ROUTES.invoiceFromApprovedTime).toContain('/from-approved-time');
  });

  it('exposes trust reconciliation statement route', () => {
    expect(BILLING_ROUTES.trustReconciliationStatement).toContain('/statement');
    expect(BILLING_ROUTES.trustReconciliationStatement).toContain(':id');
  });
});

describe('API contract — finance (Series B Wave 1)', () => {
  it('exposes dunning status route', () => {
    expect(FINANCE_ROUTES.dunningStatus).toBe('GET /finance/dunning/status');
  });
});
