// k6 load test — Crime spike
// Run: k6 run tests/load/crime-spike.js
import http from "k6/http";
import { check, sleep } from "k6";
import { Rate, Trend } from "k6/metrics";

const BASE_URL = __ENV.BASE_URL || "http://localhost:3001/api/v1";

const errorRate = new Rate("errors");
const crimeLatency = new Trend("crime_latency");

export const options = {
  stages: [
    { target: 10, duration: "30s" },
    { target: 50, duration: "1m" },
    { target: 100, duration: "2m" },
    { target: 200, duration: "2m" },
    { target: 0, duration: "30s" },
  ],
  thresholds: {
    errors: ["rate<0.01"],
    crime_latency: ["p(95)<500"],
    http_req_duration: ["p(95)<1000"],
  },
};

export default function () {
  const res = http.get(`${BASE_URL}/health/`);
  check(res, { "health ok": (r) => r.status === 200 });
  sleep(1);
}
