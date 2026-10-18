import { isExpressIndiaDraftKind } from '@/ai/india-draft/india-draft-express';

describe('isExpressIndiaDraftKind', () => {
  it('treats legal notices as express', () => {
    expect(isExpressIndiaDraftKind('india_legal_notice')).toBe(true);
  });

  it('treats court pleadings as full pipeline', () => {
    expect(isExpressIndiaDraftKind('india_civil_plaint')).toBe(false);
    expect(isExpressIndiaDraftKind('india_maintenance_order_revision')).toBe(false);
  });
});
