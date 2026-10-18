import { RootController } from './root.controller';

describe('RootController', () => {
  const controller = new RootController();

  it('returns a minimal public response without deployment metadata', () => {
    const response = controller.getRoot();

    expect(response).toEqual({
      status: 'ok',
      api: '/api/v1',
    });
    expect(response).not.toHaveProperty('environment');
    expect(response).not.toHaveProperty('deployment');
    expect(response).not.toHaveProperty('gitCommit');
    expect(response).not.toHaveProperty('timestamp');
  });
});
