/**
 * Global Teardown for Playwright E2E Tests
 *
 * This file runs once after all E2E tests complete.
 * It can be used to:
 * - Clean up test data
 * - Close database connections
 * - Generate test reports
 * - Archive test artifacts
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import type { FullConfig } from '@playwright/test';

async function globalTeardown(config: FullConfig) {
  console.log('\n🧹 Starting global teardown...');

  // Clean up test data if needed
  if (process.env.CLEANUP_TEST_DATA === 'true') {
    console.log('🗑️  Cleaning up test data...');
    try {
      // Run cleanup script if it exists
      const cleanupScript = path.join(process.cwd(), 'scripts', 'cleanup-test-data.ts');
      if (fs.existsSync(cleanupScript)) {
        execSync('tsx scripts/cleanup-test-data.ts', { stdio: 'inherit' });
      }
    } catch (error) {
      console.warn('⚠️  Cleanup may have failed, continuing anyway...');
    }
  }

  // Generate consolidated report
  if (process.env.CI) {
    console.log('📊 Generating test report...');
    const reportDir = path.join(process.cwd(), 'playwright-report');

    if (fs.existsSync(reportDir)) {
      // Create summary file
      const summary = {
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'unknown',
        ci: process.env.CI === 'true',
        commit: process.env.GITHUB_SHA || 'unknown',
        branch: process.env.GITHUB_REF_NAME || 'unknown',
      };

      fs.writeFileSync(path.join(reportDir, 'summary.json'), JSON.stringify(summary, null, 2));
    }
  }

  // Clean up storage state files
  const storageState = config.projects[0].use.storageState;
  if (storageState && typeof storageState === 'string') {
    try {
      if (fs.existsSync(storageState)) {
        fs.unlinkSync(storageState);
        console.log('🗑️  Cleaned up storage state file');
      }
    } catch (error) {
      console.warn('⚠️  Failed to clean up storage state file');
    }
  }

  console.log('✅ Global teardown complete');
}

export default globalTeardown;
