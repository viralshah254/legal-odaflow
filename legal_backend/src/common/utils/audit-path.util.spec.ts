import {
  normalizeAuditPath,
  redactAuditPath,
  shouldLogAuditRequest,
} from './audit-path.util';

describe('audit-path.util', () => {
  describe('redactAuditPath', () => {
    it('redacts UUID, numeric, and email path segments', () => {
      expect(
        redactAuditPath(
          '/matters/550e8400-e29b-41d4-a716-446655440000/notes/42',
        ),
      ).toBe('/matters/:id/notes/:id');
      expect(redactAuditPath('/users/jane.doe@example.com/profile')).toBe(
        '/users/:email/profile',
      );
    });

    it('redacts query strings entirely', () => {
      expect(redactAuditPath('/notifications?userId=abc&token=secret')).toBe(
        '/notifications?[redacted]',
      );
    });

    it('preserves static route templates', () => {
      expect(redactAuditPath('/matters/:matterId/notes')).toBe(
        '/matters/:matterId/notes',
      );
    });
  });

  describe('normalizeAuditPath', () => {
    it('removes the global API prefix for sampling rules', () => {
      expect(normalizeAuditPath('/api/v1/health/readiness')).toBe(
        '/health/readiness',
      );
      expect(normalizeAuditPath('/health')).toBe('/health');
    });
  });

  describe('shouldLogAuditRequest', () => {
    it('always logs non high-volume routes', () => {
      expect(
        shouldLogAuditRequest('POST', '/matters', () => 0.99),
      ).toBe(true);
    });

    it('samples high-volume routes using the provided random source', () => {
      expect(
        shouldLogAuditRequest('GET', '/health', () => 0.01),
      ).toBe(true);
      expect(
        shouldLogAuditRequest('GET', '/health', () => 0.5),
      ).toBe(false);
      expect(
        shouldLogAuditRequest('GET', '/me/counts', () => 0.05),
      ).toBe(true);
      expect(
        shouldLogAuditRequest('GET', '/me/counts', () => 0.5),
      ).toBe(false);
    });
  });
});
