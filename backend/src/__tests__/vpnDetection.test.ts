import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../config/redis", () => ({
  redis: {
    get:    vi.fn(),
    set:    vi.fn(),
    exists: vi.fn(),
  },
  default: {
    get:    vi.fn(),
    set:    vi.fn(),
    exists: vi.fn(),
  },
}));

vi.mock("../utils/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("../services/immunityCheck", () => ({
  isImmuneFromUAC: vi.fn().mockResolvedValue(false),
}));

vi.mock("../services/trustEngine", () => ({
  flagUser: vi.fn().mockResolvedValue({ skipped: false }),
}));

vi.mock("../config", () => ({
  config: {
    blockedCountries: [],
    isTest:           true,
    isProduction:     false,
  },
}));

import { redis }          from "../config/redis";
import { checkVpnProxy }  from "../services/vpnDetection";
import { flagUser }       from "../services/trustEngine";
import { isImmuneFromUAC } from "../services/immunityCheck";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

beforeEach(() => vi.resetAllMocks());

function makeIpApiResponse(overrides = {}) {
  return {
    status:      "success",
    proxy:       false,
    vpn:         false,
    tor:         false,
    hosting:     false,
    isp:         "Test ISP",
    org:         "Test Org",
    country:     "United States",
    countryCode: "US",
    query:       "1.2.3.4",
    ...overrides,
  };
}

function mockFetchResponse(data: object) {
  mockFetch.mockResolvedValueOnce({
    ok:   true,
    json: vi.fn().mockResolvedValueOnce(data),
  });
}

describe("checkVpnProxy", () => {
  it("returns default result for undefined IP", async () => {
    const result = await checkVpnProxy("uid-123", undefined);
    expect(result.isVpn).toBe(false);
    expect(result.isTor).toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("skips private IPs (127.0.0.1)", async () => {
    const result = await checkVpnProxy("uid-123", "127.0.0.1");
    expect(result.isVpn).toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("skips private IPs (10.x.x.x)", async () => {
    const result = await checkVpnProxy("uid-123", "10.0.0.1");
    expect(mockFetch).not.toHaveBeenCalled();
    expect(result.isVpn).toBe(false);
  });

  it("skips private IPs (192.168.x.x)", async () => {
    const result = await checkVpnProxy("uid-123", "192.168.1.1");
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns cached result from Redis", async () => {
    vi.mocked(redis.get).mockResolvedValueOnce(
      JSON.stringify(makeIpApiResponse())
    );

    const result = await checkVpnProxy("uid-123", "8.8.8.8");
    expect(result.isVpn).toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("detects VPN and flags user", async () => {
    vi.mocked(redis.get).mockResolvedValueOnce(null);
    vi.mocked(redis.set).mockResolvedValueOnce("OK" as never);

    mockFetchResponse(makeIpApiResponse({ vpn: true, proxy: false }));

    vi.mocked(redis.set).mockResolvedValue("OK" as never);

    const result = await checkVpnProxy("uid-123", "8.8.8.8");

    expect(result.isVpn).toBe(true);
    expect(flagUser).toHaveBeenCalledWith(
      expect.objectContaining({ violationType: "VPN_PROXY_DETECTED" })
    );
  });

  it("detects Tor and flags user", async () => {
    vi.mocked(redis.get).mockResolvedValueOnce(null);
    vi.mocked(redis.set).mockResolvedValue("OK" as never);

    mockFetchResponse(makeIpApiResponse({ tor: true }));

    const result = await checkVpnProxy("uid-123", "8.8.8.8");
    expect(result.isTor).toBe(true);
    expect(flagUser).toHaveBeenCalledWith(
      expect.objectContaining({ violationType: "TOR_DETECTED" })
    );
  });

  it("detects datacenter IP and flags user", async () => {
    vi.mocked(redis.get).mockResolvedValueOnce(null);
    vi.mocked(redis.set).mockResolvedValue("OK" as never);

    mockFetchResponse(makeIpApiResponse({ hosting: true, vpn: false, proxy: false }));

    const result = await checkVpnProxy("uid-123", "8.8.8.8");
    expect(result.isHosting).toBe(true);
    expect(flagUser).toHaveBeenCalledWith(
      expect.objectContaining({ violationType: "DATACENTER_IP" })
    );
  });

  it("skips flagging for immune users", async () => {
    vi.mocked(isImmuneFromUAC).mockResolvedValueOnce(true);
    vi.mocked(redis.get).mockResolvedValueOnce(null);
    vi.mocked(redis.set).mockResolvedValue("OK" as never);

    mockFetchResponse(makeIpApiResponse({ vpn: true }));

    const result = await checkVpnProxy("admin-uid", "8.8.8.8");
    expect(result.isVpn).toBe(true);
    expect(flagUser).not.toHaveBeenCalled();
  });

  it("fails open when API returns non-200", async () => {
    vi.mocked(redis.get).mockResolvedValueOnce(null);
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

    const result = await checkVpnProxy("uid-123", "8.8.8.8");
    expect(result.isVpn).toBe(false);
    expect(flagUser).not.toHaveBeenCalled();
  });

  it("fails open when fetch throws", async () => {
    vi.mocked(redis.get).mockResolvedValueOnce(null);
    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    const result = await checkVpnProxy("uid-123", "8.8.8.8");
    expect(result.isVpn).toBe(false);
    expect(flagUser).not.toHaveBeenCalled();
  });

  it("strips ::ffff: prefix from IPv4-mapped IPv6", async () => {
    vi.mocked(redis.get).mockResolvedValueOnce(null);
    vi.mocked(redis.set).mockResolvedValue("OK" as never);
    mockFetchResponse(makeIpApiResponse());

    await checkVpnProxy("uid-123", "::ffff:8.8.8.8");
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("8.8.8.8"),
      expect.any(Object)
    );
  });
});
