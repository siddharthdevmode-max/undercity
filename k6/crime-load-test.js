/**
 * UNDERCITY LOAD TEST
 * Run: k6 run k6/crime-load-test.js
 * Install k6: brew install k6  OR  https://k6.io/docs/get-started/installation/
 *
 * Targets:
 *   - 500 concurrent users
 *   - P95 response < 500ms
 *   - Error rate < 1%
 */

import http  from "k6/http";
import { check, sleep } from "k6";
import { Rate, Trend } from "k6/metrics";

const errorRate    = new Rate("errors");
const crimeLatency = new Trend("crime_latency");
const healthLatency = new Trend("health_latency");

const BASE_URL = __ENV.BASE_URL || "http://localhost:5000"\;

export const options = {
  stages: [
    { duration: "30s", target: 50  },  // Ramp up
    { duration: "1m",  target: 200 },  // Steady
    { duration: "30s", target: 500 },  // Peak
    { duration: "30s", target: 0   },  // Ramp down
  ],
  thresholds: {
    http_req_duration: ["p(95)<500"],  // P95 < 500ms
    errors:            ["rate<0.01"],  // Error rate < 1%
    health_latency:    ["p(95)<100"],  // Health check < 100ms
  },
};

export default function () {
  // Health check
  const healthRes = http.get(`${BASE_URL}/api/health`);
  healthLatency.add(healthRes.timings.duration);

  check(healthRes, {
    "health is 200": (r) => r.status === 200,
  }) || errorRate.add(1);

  sleep(0.1);

  // Stats endpoint (public, no auth)
  const statsRes = http.get(`${BASE_URL}/api/v1/stats/live`);

  check(statsRes, {
    "stats is 200": (r) => r.status === 200,
  }) || errorRate.add(1);

  crimeLatency.add(statsRes.timings.duration);

  sleep(1);
}

export function handleSummary(data) {
  return {
    "k6/results.json": JSON.stringify(data),
    stdout: generateSummary(data),
  };
}

function generateSummary(data) {
  const p95 = data.metrics.http_req_duration?.values?.["p(95)"] || 0;
  const errRate = (data.metrics.errors?.values?.rate || 0) * 100;

  return `
════════════════════════════════════════
  UNDERCITY LOAD TEST RESULTS
════════════════════════════════════════
  P95 Response Time : ${p95.toFixed(0)}ms  (target: <500ms)
  Error Rate        : ${errRate.toFixed(2)}%  (target: <1%)
  Total Requests    : ${data.metrics.http_reqs?.values?.count || 0}
════════════════════════════════════════
  ${p95 < 500 && errRate < 1 ? "✅ PASSED — Ready for launch" : "❌ FAILED — Needs optimization"}
════════════════════════════════════════
  `;
}
