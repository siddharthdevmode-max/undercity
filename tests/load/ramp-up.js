// k6 ramp-up test — 0 to 500 users
// Run: k6 run tests/load/ramp-up.js
import http from "k6/http";
import { check, sleep } from "k6";

const BASE_URL = __ENV.BASE_URL || "http://localhost:3001/api/v1";

export const options = {
  stages: [
    { target: 50, duration: "1m" },
    { target: 100, duration: "2m" },
    { target: 250, duration: "3m" },
    { target: 500, duration: "5m" },
    { target: 0, duration: "1m" },
  ],
  thresholds: {
    http_req_duration: ["p(95)<500", "avg<200"],
    http_req_failed: ["rate<0.001"],
  },
};

export default function () {
  const res = http.get(`${BASE_URL}/stats/live`);
  check(res, { "status 200": (r) => r.status === 200 });
  sleep(Math.random() * 3 + 1);
}
