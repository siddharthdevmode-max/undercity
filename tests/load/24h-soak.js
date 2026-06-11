// k6 24h soak test — memory leak detection
// Run: k6 run --duration 24h tests/load/24h-soak.js
import http from "k6/http";
import { check, sleep } from "k6";

const BASE_URL = __ENV.BASE_URL || "http://localhost:3001/api/v1";

export const options = {
  vus: 50,
  duration: "24h",
  thresholds: {
    http_req_duration: ["p(95)<2000"],
    http_req_failed: ["rate<0.01"],
  },
};

export default function () {
  const endpoints = ["/health/", "/stats/live", "/health/detailed"];
  const url = `${BASE_URL}${endpoints[Math.floor(Math.random() * endpoints.length)]}`;
  const res = http.get(url);
  check(res, { "status ok": (r) => r.status === 200 });
  sleep(Math.random() * 5 + 5);
}
