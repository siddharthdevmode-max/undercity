// ============================================================
// STATS SERVICE — UNIT TESTS
// ============================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getLiveStats } from '../stats';

describe('getLiveStats', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns live stats when API responds OK', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok:   true,
      json: async () => ({
        onlineNow:   42,
        last3Hours:  100,
        last24Hours: 500,
        attacks24h:  10,
        crimes24h:   200,
        casino24h:   5,
      }),
    } as Response);

    const stats = await getLiveStats();
    expect(stats.onlineNow).toBe(42);
    expect(stats.crimes24h).toBe(200);
  });

  it('returns zero stats when API fails', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
    } as Response);

    const stats = await getLiveStats();
    expect(stats.onlineNow).toBe(0);
    expect(stats.crimes24h).toBe(0);
  });

  it('returns zero stats on network error', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('Network down'));
    const stats = await getLiveStats();
    expect(stats.onlineNow).toBe(0);
    expect(stats.last24Hours).toBe(0);
  });

  it('defaults missing fields to 0', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok:   true,
      json: async () => ({ onlineNow: 10 }), // only one field
    } as Response);

    const stats = await getLiveStats();
    expect(stats.onlineNow).toBe(10);
    expect(stats.last3Hours).toBe(0);
    expect(stats.attacks24h).toBe(0);
  });

  it('returns correct shape with all 6 fields', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok:   true,
      json: async () => ({}),
    } as Response);

    const stats = await getLiveStats();
    expect(stats).toMatchObject({
      onlineNow:   expect.any(Number),
      last3Hours:  expect.any(Number),
      last24Hours: expect.any(Number),
      attacks24h:  expect.any(Number),
      crimes24h:   expect.any(Number),
      casino24h:   expect.any(Number),
    });
  });

  it('handles timeout gracefully', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(
      Object.assign(new Error('Timeout'), { name: 'TimeoutError' })
    );
    const stats = await getLiveStats();
    expect(stats.onlineNow).toBe(0);
  });
});
