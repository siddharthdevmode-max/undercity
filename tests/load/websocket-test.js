// WebSocket load test — 500 concurrent connections
// Uses k6 WebSocket API
// Run: k6 run tests/load/websocket-test.js
import { WebSocket } from "k6/experimental/websockets";
import { sleep, check } from "k6";

const BASE_URL = __ENV.BASE_URL || "ws://localhost:3001";

export const options = {
  stages: [
    { target: 50, duration: "30s" },
    { target: 200, duration: "1m" },
    { target: 500, duration: "2m" },
    { target: 0, duration: "30s" },
  ],
  thresholds: {
    ws_connecting: ["avg<100"],
    ws_session_duration: ["avg>10000"],
  },
};

export default function () {
  const url = `${BASE_URL}/socket.io/?EIO=4&transport=websocket`;
  const ws = new WebSocket(url);
  ws.onopen = () => { ws.send('42["ping"]'); };
  ws.onclose = () => {};
  ws.onerror = (e) => { console.log("WS error:", JSON.stringify(e)); };
  sleep(30);
  ws.close();
}
