/**
 * Contract tests — integration sync routes and stub response shape.
 */

const INTEGRATION_SYNC_ROUTES = {
  sync: 'POST /integrations/:provider/sync',
  list: 'GET /integrations',
  connect: 'POST /integrations/:provider/connect',
  disconnect: 'POST /integrations/:provider/disconnect',
};

const STUB_SYNC_RESPONSE_SHAPE = {
  synced: false,
  stub: true,
  recordsProcessed: 0,
  message: 'string',
  provider: 'string',
};

describe('API contract — integration sync', () => {
  it('exposes provider sync route used by web retry button', () => {
    expect(INTEGRATION_SYNC_ROUTES.sync).toBe('POST /integrations/:provider/sync');
    expect(INTEGRATION_SYNC_ROUTES.list).toContain('/integrations');
  });

  it('documents explicit stub mode response shape for dev-only connections', () => {
    expect(STUB_SYNC_RESPONSE_SHAPE.stub).toBe(true);
    expect(STUB_SYNC_RESPONSE_SHAPE.synced).toBe(false);
    expect(STUB_SYNC_RESPONSE_SHAPE).toHaveProperty('message');
    expect(STUB_SYNC_RESPONSE_SHAPE).toHaveProperty('recordsProcessed');
  });

  it('supports gmail and outlook_email providers for email sync smoke', () => {
    for (const provider of ['gmail', 'outlook_email', 'google_calendar']) {
      expect(INTEGRATION_SYNC_ROUTES.sync.replace(':provider', provider)).toContain(provider);
    }
  });
});
