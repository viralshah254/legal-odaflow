import { parseCorsOrigins } from './cors-origins.util';

describe('parseCorsOrigins', () => {
  it('splits comma-separated origins and trims whitespace', () => {
    expect(
      parseCorsOrigins('http://localhost:3000, https://example.com ,'),
    ).toEqual(['http://localhost:3000', 'https://example.com']);
  });

  it('falls back to localhost when empty after filtering', () => {
    expect(parseCorsOrigins(',')).toEqual([]);
  });
});
