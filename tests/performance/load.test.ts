/**
 * Load Testing Configuration
 *
 * Performance tests using Artillery-style configuration.
 * Run with: k6 run load.test.ts
 *
 * Note: This file contains configurations that can be used with k6 or Artillery.
 * For actual execution, install k6: brew install k6
 */

import { check, sleep } from 'k6';
import http from 'k6/http';

// Test configuration
export const options = {
  scenarios: {
    // Smoke test - minimal load to verify functionality
    smoke: {
      executor: 'constant-vus',
      vus: 1,
      duration: '1m',
      tags: { test_type: 'smoke' },
    },

    // Load test - normal expected load
    load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 10 }, // Ramp up
        { duration: '5m', target: 10 }, // Steady state
        { duration: '2m', target: 20 }, // Increase
        { duration: '5m', target: 20 }, // Steady state
        { duration: '2m', target: 0 }, // Ramp down
      ],
      tags: { test_type: 'load' },
    },

    // Stress test - find breaking point
    stress: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 50 },
        { duration: '5m', target: 50 },
        { duration: '2m', target: 100 },
        { duration: '5m', target: 100 },
        { duration: '2m', target: 150 },
        { duration: '5m', target: 150 },
        { duration: '2m', target: 0 },
      ],
      tags: { test_type: 'stress' },
    },

    // Spike test - sudden traffic increase
    spike: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '10s', target: 10 },
        { duration: '1m', target: 10 },
        { duration: '10s', target: 100 },
        { duration: '3m', target: 100 },
        { duration: '10s', target: 10 },
        { duration: '3m', target: 10 },
        { duration: '10s', target: 0 },
      ],
      tags: { test_type: 'spike' },
    },

    // Soak test - prolonged load to find memory leaks
    soak: {
      executor: 'constant-vus',
      vus: 20,
      duration: '30m',
      tags: { test_type: 'soak' },
    },
  },

  thresholds: {
    http_req_duration: ['p(95)<2000'], // 95% of requests under 2s
    http_req_failed: ['rate<0.05'], // Less than 5% errors
    http_reqs: ['rate>10'], // At least 10 RPS
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const API_KEY = __ENV.API_KEY || '';

export default function () {
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${API_KEY}`,
  };

  // Test health endpoint
  {
    const response = http.get(`${BASE_URL}/api/health`, { headers });
    check(response, {
      'health status is 200': (r) => r.status === 200,
      'health response time < 500ms': (r) => r.timings.duration < 500,
    });
  }

  sleep(1);

  // Test chat endpoint
  {
    const payload = JSON.stringify({
      message: 'What is the revenue for Q1?',
      workspaceId: 'test-workspace',
    });

    const response = http.post(`${BASE_URL}/api/chat`, payload, { headers });
    check(response, {
      'chat status is 200': (r) => r.status === 200,
      'chat response time < 5000ms': (r) => r.timings.duration < 5000,
    });
  }

  sleep(2);

  // Test documents list
  {
    const response = http.get(`${BASE_URL}/api/documents?workspaceId=test-workspace`, { headers });
    check(response, {
      'documents status is 200': (r) => r.status === 200,
      'documents response time < 1000ms': (r) => r.timings.duration < 1000,
    });
  }

  sleep(1);
}

// Setup function run once before the test
export function setup() {
  console.log(`Starting load test against ${BASE_URL}`);

  // Verify the target is reachable
  const response = http.get(`${BASE_URL}/api/health`);
  if (response.status !== 200) {
    throw new Error(`Target ${BASE_URL} is not reachable`);
  }

  return { startTime: new Date().toISOString() };
}

// Teardown function run once after the test
export function teardown(data: { startTime: string }) {
  console.log(`Load test completed. Started at: ${data.startTime}`);
}

/**
 * Custom metrics and checks
 */
export function handleSummary(data: any) {
  return {
    'performance-results.json': JSON.stringify(data, null, 2),
    stdout: `
========================================
LOAD TEST SUMMARY
========================================
Duration: ${data.state.testRunDuration}
Virtual Users: ${data.metrics.vus?.values?.value || 'N/A'}

REQUEST METRICS:
- Total Requests: ${data.metrics.http_reqs?.values?.count || 0}
- Failed Requests: ${data.metrics.http_req_failed?.values?.passes || 0}
- Average Response Time: ${data.metrics.http_req_duration?.values?.avg?.toFixed(2) || 'N/A'}ms
- P95 Response Time: ${data.metrics.http_req_duration?.values['p(95)']?.toFixed(2) || 'N/A'}ms
- P99 Response Time: ${data.metrics.http_req_duration?.values['p(99)']?.toFixed(2) || 'N/A'}ms

THRESHOLDS:
${Object.entries(data.metrics)
  .filter(([_, v]: [string, any]) => v.thresholds)
  .map(([k, v]: [string, any]) => `- ${k}: ${v.thresholds ? 'PASS' : 'FAIL'}`)
  .join('\n')}

========================================
    `,
  };
}
