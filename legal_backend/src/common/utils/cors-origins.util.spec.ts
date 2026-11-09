import { parseCorsOrigins, resolveCorsOrigin } from './cors-origins.util';

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

describe('realtime CORS after environment initialization', () => {
  const original = process.env.CORS_ORIGINS;
  afterEach(() => {
    if (original === undefined) delete process.env.CORS_ORIGINS;
    else process.env.CORS_ORIGINS = original;
  });

  it('reads the configured production domain at request time after module import', () => {
    delete process.env.CORS_ORIGINS;
    process.env.CORS_ORIGINS = 'https://legal.odaflow.com';
    const callback = jest.fn();
    resolveCorsOrigin('https://legal.odaflow.com', callback);
    expect(callback).toHaveBeenCalledWith(null, true);
    process.env.CORS_ORIGINS = 'https://another.example';
    callback.mockClear();
    resolveCorsOrigin('https://legal.odaflow.com', callback);
    expect(callback).toHaveBeenCalledWith(null, false);
  });

  it('rejects lookalike origins and permits native clients without an Origin header', () => {
    process.env.CORS_ORIGINS = 'https://legal.odaflow.com';
    const callback = jest.fn();
    resolveCorsOrigin('https://legal.odaflow.com.attacker.example', callback);
    expect(callback).toHaveBeenLastCalledWith(null, false);
    resolveCorsOrigin(undefined, callback);
    expect(callback).toHaveBeenLastCalledWith(null, true);
  });
});
