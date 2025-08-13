import http from "k6/http";
import { check, sleep } from "k6";
import { Rate } from "k6/metrics";

// Custom metrics
const errorRate = new Rate("errors");
const successRate = new Rate("success");

// Test configuration
export const options = {
  stages: [
    { duration: "2m", target: 100 }, // Ramp up to 100 users
    { duration: "5m", target: 100 }, // Stay at 100 users
    { duration: "2m", target: 200 }, // Ramp up to 200 users
    { duration: "5m", target: 200 }, // Stay at 200 users
    { duration: "2m", target: 0 }, // Ramp down to 0 users
  ],
  thresholds: {
    http_req_duration: ["p(95)<500"], // 95% of requests should be below 500ms
    errors: ["rate<0.1"], // Error rate should be below 10%
    success: ["rate>0.9"], // Success rate should be above 90%
  },
};

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";
let authToken = null;

// Setup - run once per VU
export function setup() {
  // Register a test user and get auth token
  const registerPayload = JSON.stringify({
    email: `test_${Date.now()}@example.com`,
    password: "testpassword123",
    name: "Load Test User",
  });

  const registerRes = http.post(
    `${BASE_URL}/api/auth/register`,
    registerPayload,
    {
      headers: { "Content-Type": "application/json" },
    }
  );

  if (registerRes.status === 200) {
    const data = JSON.parse(registerRes.body);
    return { token: data.token };
  }

  console.error("Failed to setup test user");
  return { token: null };
}

// Main test scenarios
export default function (data) {
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${data.token}`,
  };

  // Scenario 1: Send single event
  const eventPayload = JSON.stringify({
    type: "api_call",
    metadata: {
      endpoint: "/api/test",
      method: "GET",
      statusCode: 200,
      userId: `user_${__VU}`,
    },
    duration: Math.random() * 100,
    value: Math.random() * 1000,
  });

  const eventRes = http.post(`${BASE_URL}/api/events`, eventPayload, {
    headers,
  });

  check(eventRes, {
    "event ingestion status is 200": (r) => r.status === 200,
    "event ingestion response time < 200ms": (r) => r.timings.duration < 200,
  });

  errorRate.add(eventRes.status !== 200);
  successRate.add(eventRes.status === 200);

  sleep(0.1);

  // Scenario 2: Send batch events
  const batchPayload = JSON.stringify({
    events: Array.from({ length: 10 }, (_, i) => ({
      type: ["pageview", "click", "api_call"][Math.floor(Math.random() * 3)],
      metadata: {
        page: `/page_${i}`,
        session: `session_${__VU}_${__ITER}`,
      },
      timestamp: new Date().toISOString(),
    })),
  });

  const batchRes = http.post(`${BASE_URL}/api/events/batch`, batchPayload, {
    headers,
  });

  check(batchRes, {
    "batch ingestion status is 200": (r) => r.status === 200,
    "batch ingestion response time < 500ms": (r) => r.timings.duration < 500,
  });

  errorRate.add(batchRes.status !== 200);
  successRate.add(batchRes.status === 200);

  sleep(0.2);

  // Scenario 3: Query metrics
  const metricsPayload = JSON.stringify({
    metric: "response_time",
    aggregationType: "avg",
    interval: "5m",
    startTime: new Date(Date.now() - 3600000).toISOString(),
    endTime: new Date().toISOString(),
  });

  const metricsRes = http.post(
    `${BASE_URL}/api/metrics/aggregate`,
    metricsPayload,
    { headers }
  );

  check(metricsRes, {
    "metrics query status is 200": (r) => r.status === 200,
    "metrics query response time < 300ms": (r) => r.timings.duration < 300,
    "metrics query returns data": (r) => {
      try {
        const data = JSON.parse(r.body);
        return Array.isArray(data) && data.length > 0;
      } catch {
        return false;
      }
    },
  });

  errorRate.add(metricsRes.status !== 200);
  successRate.add(metricsRes.status === 200);

  sleep(0.5);

  // Scenario 4: Real-time metrics
  const realtimeRes = http.get(
    `${BASE_URL}/api/metrics/realtime/response_time?interval=1m`,
    { headers }
  );

  check(realtimeRes, {
    "realtime metrics status is 200": (r) => r.status === 200,
    "realtime metrics response time < 100ms": (r) => r.timings.duration < 100,
  });

  errorRate.add(realtimeRes.status !== 200);
  successRate.add(realtimeRes.status === 200);

  sleep(1);
}

// Teardown - run once after all iterations
export function teardown(data) {
  console.log("Load test completed");
}
