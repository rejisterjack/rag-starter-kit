/**
 * Virus Scanner Module
 *
 * Provides file scanning capabilities for detecting malware in uploaded files.
 * Supports multiple backends: ClamAV (TCP socket), ClamAV daemon (local), and
 * a mock implementation for development/testing.
 *
 * Security Note: Always enable virus scanning in production environments
 * to prevent malware distribution through document uploads.
 */

import { AuditEvent, logAuditEvent } from '@/lib/audit/audit-logger';

// =============================================================================
// Types
// =============================================================================

export interface ScanResult {
  /** Whether the file is clean (no threats detected) */
  clean: boolean;
  /** Name of the threat if detected */
  threatName?: string;
  /** Scanner used for the scan */
  scanner: string;
  /** Scan duration in milliseconds */
  scanTimeMs: number;
  /** Error message if scan failed */
  error?: string;
}

export interface VirusScannerConfig {
  /** Scanner backend to use */
  backend: 'clamav-tcp' | 'clamav-local' | 'mock' | 'none';
  /** ClamAV host (for tcp backend) */
  host?: string;
  /** ClamAV port (for tcp backend) */
  port?: number;
  /** ClamAV socket path (for local backend) */
  socketPath?: string;
  /** Connection timeout in ms */
  timeout?: number;
  /** Maximum file size to scan (bytes) */
  maxFileSize?: number;
}

// =============================================================================
// Configuration
// =============================================================================

const DEFAULT_CONFIG: VirusScannerConfig = {
  backend: process.env.ENABLE_VIRUS_SCAN === 'true' ? 'clamav-tcp' : 'none',
  host: process.env.CLAMAV_HOST || 'localhost',
  port: parseInt(process.env.CLAMAV_PORT || '3310', 10),
  socketPath: '/var/run/clamav/clamd.ctl',
  timeout: 30000,
  maxFileSize: 100 * 1024 * 1024, // 100MB
};

// =============================================================================
// Virus Scanner
// =============================================================================

export class VirusScanner {
  private config: VirusScannerConfig;

  constructor(config: Partial<VirusScannerConfig> = {}) {
    // Determine backend from environment if not specified
    const envBackend =
      process.env.ENABLE_VIRUS_SCAN === 'true'
        ? process.env.CLAMAV_HOST
          ? 'clamav-tcp'
          : 'clamav-local'
        : 'none';

    this.config = {
      ...DEFAULT_CONFIG,
      backend: envBackend as VirusScannerConfig['backend'],
      ...config,
    };
  }

  /**
   * Scan a file buffer for viruses/malware
   */
  async scanFile(
    buffer: Buffer,
    filename?: string,
    metadata?: { workspaceId?: string; userId?: string }
  ): Promise<ScanResult> {
    const startTime = Date.now();

    // Skip scanning if disabled
    if (this.config.backend === 'none') {
      return {
        clean: true,
        scanner: 'none',
        scanTimeMs: 0,
      };
    }

    // Check file size limit
    if (this.config.maxFileSize && buffer.length > this.config.maxFileSize) {
      const result: ScanResult = {
        clean: false,
        scanner: this.config.backend,
        scanTimeMs: Date.now() - startTime,
        error: `File size (${this.formatBytes(buffer.length)}) exceeds maximum scan size (${this.formatBytes(this.config.maxFileSize)})`,
      };

      await this.logScanResult(filename, result, metadata);
      return result;
    }

    try {
      let result: ScanResult;

      switch (this.config.backend) {
        case 'clamav-tcp':
          result = await this.scanWithClamAVTCP(buffer);
          break;
        case 'clamav-local':
          result = await this.scanWithClamAVLocal(buffer);
          break;
        case 'mock':
          result = await this.scanWithMock(buffer);
          break;
        default:
          result = {
            clean: true,
            scanner: 'none',
            scanTimeMs: Date.now() - startTime,
          };
      }

      result.scanTimeMs = Date.now() - startTime;
      await this.logScanResult(filename, result, metadata);

      return result;
    } catch (error) {
      const errorResult: ScanResult = {
        clean: false,
        scanner: this.config.backend,
        scanTimeMs: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Scan failed',
      };

      await this.logScanResult(filename, errorResult, metadata);
      return errorResult;
    }
  }

  /**
   * Quick check if virus scanning is enabled
   */
  isEnabled(): boolean {
    return this.config.backend !== 'none';
  }

  /**
   * Get scanner status/health
   */
  async healthCheck(): Promise<{ healthy: boolean; message: string }> {
    if (this.config.backend === 'none') {
      return { healthy: true, message: 'Virus scanning disabled' };
    }

    try {
      // Try a ping to the scanner
      const testBuffer = Buffer.from('PING');
      const result = await this.scanFile(testBuffer, 'health-check.txt');

      if (result.error && !result.clean) {
        return { healthy: false, message: result.error };
      }

      return {
        healthy: true,
        message: `${result.scanner} scanner is operational`,
      };
    } catch (error) {
      return {
        healthy: false,
        message: error instanceof Error ? error.message : 'Health check failed',
      };
    }
  }

  // ===========================================================================
  // Private Scanning Methods
  // ===========================================================================

  /**
   * Scan using ClamAV via TCP (for remote ClamAV servers)
   */
  private async scanWithClamAVTCP(buffer: Buffer): Promise<ScanResult> {
    const net = await import('net');

    return new Promise((resolve, reject) => {
      const host = this.config.host || 'localhost';
      const port = this.config.port || 3310;
      const timeout = this.config.timeout || 30000;

      const client = net.createConnection({ host, port, timeout }, () => {
        // Send INSTREAM command
        client.write('zINSTREAM\0');

        // Send file size as 4-byte big-endian integer
        const sizeBuffer = Buffer.alloc(4);
        sizeBuffer.writeUInt32BE(buffer.length, 0);
        client.write(sizeBuffer);

        // Send file data
        client.write(buffer);

        // Send zero-size chunk to indicate end
        client.write(Buffer.alloc(4, 0));
      });

      let response = '';

      client.on('data', (data) => {
        response += data.toString();
      });

      client.on('end', () => {
        // Parse response: stream: OK or stream: VIRUS_NAME FOUND
        if (response.includes('OK')) {
          resolve({
            clean: true,
            scanner: 'clamav-tcp',
            scanTimeMs: 0,
          });
        } else if (response.includes('FOUND')) {
          const match = response.match(/stream: (.+) FOUND/);
          resolve({
            clean: false,
            threatName: match?.[1] || 'Unknown threat',
            scanner: 'clamav-tcp',
            scanTimeMs: 0,
          });
        } else {
          reject(new Error(`Unexpected ClamAV response: ${response}`));
        }
      });

      client.on('error', (err) => {
        reject(new Error(`ClamAV connection error: ${err.message}`));
      });

      client.on('timeout', () => {
        client.destroy();
        reject(new Error('ClamAV connection timeout'));
      });
    });
  }

  /**
   * Scan using local ClamAV daemon via Unix socket
   */
  private async scanWithClamAVLocal(buffer: Buffer): Promise<ScanResult> {
    const net = await import('net');

    return new Promise((resolve, reject) => {
      const socketPath = this.config.socketPath || '/var/run/clamav/clamd.ctl';
      const timeout = this.config.timeout || 30000;

      const client = net.createConnection({ path: socketPath, timeout }, () => {
        // Send INSTREAM command
        client.write('zINSTREAM\0');

        // Send file size as 4-byte big-endian integer
        const sizeBuffer = Buffer.alloc(4);
        sizeBuffer.writeUInt32BE(buffer.length, 0);
        client.write(sizeBuffer);

        // Send file data
        client.write(buffer);

        // Send zero-size chunk to indicate end
        client.write(Buffer.alloc(4, 0));
      });

      let response = '';

      client.on('data', (data) => {
        response += data.toString();
      });

      client.on('end', () => {
        if (response.includes('OK')) {
          resolve({
            clean: true,
            scanner: 'clamav-local',
            scanTimeMs: 0,
          });
        } else if (response.includes('FOUND')) {
          const match = response.match(/stream: (.+) FOUND/);
          resolve({
            clean: false,
            threatName: match?.[1] || 'Unknown threat',
            scanner: 'clamav-local',
            scanTimeMs: 0,
          });
        } else {
          reject(new Error(`Unexpected ClamAV response: ${response}`));
        }
      });

      client.on('error', (err) => {
        reject(new Error(`ClamAV socket error: ${err.message}`));
      });

      client.on('timeout', () => {
        client.destroy();
        reject(new Error('ClamAV socket timeout'));
      });
    });
  }

  /**
   * Mock scanner for development/testing
   */
  private async scanWithMock(buffer: Buffer): Promise<ScanResult> {
    // Simulate scan delay
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Check for EICAR test string (standard antivirus test file)
    const eicarString = 'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*';
    if (buffer.toString().includes(eicarString)) {
      return {
        clean: false,
        threatName: 'EICAR-Test-File',
        scanner: 'mock',
        scanTimeMs: 0,
      };
    }

    return {
      clean: true,
      scanner: 'mock',
      scanTimeMs: 0,
    };
  }

  // ===========================================================================
  // Private Helpers
  // ===========================================================================

  private async logScanResult(
    filename: string | undefined,
    result: ScanResult,
    metadata?: { workspaceId?: string; userId?: string }
  ): Promise<void> {
    if (!result.clean) {
      await logAuditEvent({
        event: AuditEvent.SUSPICIOUS_ACTIVITY,
        userId: metadata?.userId,
        workspaceId: metadata?.workspaceId,
        metadata: {
          activity: 'virus_detected',
          filename,
          threatName: result.threatName,
          scanner: result.scanner,
          error: result.error,
        },
        severity: 'CRITICAL',
      });
    }
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`;
  }
}

// =============================================================================
// Singleton Export
// =============================================================================

export const virusScanner = new VirusScanner();

// =============================================================================
// Convenience Functions
// =============================================================================

/**
 * Scan a file buffer for viruses
 */
export async function scanFile(
  buffer: Buffer,
  filename?: string,
  metadata?: { workspaceId?: string; userId?: string }
): Promise<ScanResult> {
  return virusScanner.scanFile(buffer, filename, metadata);
}

/**
 * Check if virus scanning is configured and available
 */
export async function isVirusScanningAvailable(): Promise<boolean> {
  const health = await virusScanner.healthCheck();
  return health.healthy;
}

/**
 * Get virus scanner health status
 */
export async function getVirusScannerHealth(): Promise<{ healthy: boolean; message: string }> {
  return virusScanner.healthCheck();
}
