import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { createMockRequest } from '@/tests/utils/helpers/setup';

describe('Health API', () => {
  it('should return healthy status when all services are up', async () => {
    const req = createMockRequest({
      method: 'GET',
      url: 'http://localhost:3000/api/health',
    });

    const response = await fetch(req);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe('healthy');
    expect(data.checks).toBeDefined();
    expect(Array.isArray(data.checks)).toBe(true);
  });

  it('should include all required health checks', async () => {
    const req = createMockRequest({
      method: 'GET',
      url: 'http://localhost:3000/api/health',
    });

    const response = await fetch(req);
    const data = await response.json();

    const checkNames = data.checks.map((c: { name: string }) => c.name);
    
    expect(checkNames).toContain('database');
    expect(checkNames).toContain('vector_extension');
    expect(checkNames).toContain('openai');
  });

  it('should include system information', async () => {
    const req = createMockRequest({
      method: 'GET',
      url: 'http://localhost:3000/api/health',
    });

    const response = await fetch(req);
    const data = await response.json();

    expect(data.system).toBeDefined();
    expect(data.system.uptime).toBeGreaterThan(0);
    expect(data.system.nodeVersion).toBeDefined();
    expect(data.system.environment).toBeDefined();
  });

  it('should include response time', async () => {
    const req = createMockRequest({
      method: 'GET',
      url: 'http://localhost:3000/api/health',
    });

    const response = await fetch(req);
    const data = await response.json();

    expect(data.responseTime).toBeDefined();
    expect(data.responseTime).toBeGreaterThanOrEqual(0);
  });
});
