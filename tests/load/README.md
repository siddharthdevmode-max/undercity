# Load Testing — Undercity

## Prerequisites
```bash
# Install k6
# macOS: brew install k6
# Linux: https://k6.io/docs/getting-started/installation/
```

## Test Scripts

### 1. Ramp Up (0→500 users)
```bash
k6 run tests/load/ramp-up.js
```

### 2. Crime Spike (100 concurrent attempts)
```bash
k6 run tests/load/crime-spike.js
```

### 3. WebSocket Load (500 concurrent connections)
```bash
k6 run tests/load/websocket-test.js
```

### 4. 24h Soak Test
```bash
k6 run --duration 24h tests/load/24h-soak.js
```

## Pass Criteria
- p95 < 500ms under 500 users
- Error rate < 0.1%
- DB pool never exhausts
- Game tick runs clean
- No memory leak < 10mb drift over 24h
