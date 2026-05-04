/**
 * Connectivity State Machine with Lie-fi Detection
 * Provides advanced network state management that goes beyond simple online/offline detection.
 * Detects "Lie-fi" scenarios where the device reports online but has no actual connectivity.
 */

import {
  CHANNELS,
  DEGRADED_RTT_THRESHOLD,
  HEARTBEAT_ENDPOINT,
  HEARTBEAT_INTERVAL,
  LIEFI_RTT_THRESHOLD,
  LIEFI_TIMEOUT_COUNT,
  LIEFI_TIMEOUT_WINDOW,
} from './constants';
import { processSyncQueue } from './sync-manager';
import type { BroadcastConnectivityMessage, ConnectivityInfo, ConnectivityState } from './types';

// ─── Network Information API Types ────────────────────────────────────────────

interface NetworkInformation extends EventTarget {
  effectiveType?: 'slow-2g' | '2g' | '3g' | '4g';
  rtt?: number;
  downlink?: number;
  saveData?: boolean;
  addEventListener(type: 'change', listener: () => void): void;
  removeEventListener(type: 'change', listener: () => void): void;
}

interface NavigatorWithConnection extends Navigator {
  connection?: NetworkInformation;
  mozConnection?: NetworkInformation;
  webkitConnection?: NetworkInformation;
}

// ─── Broadcast Channel ────────────────────────────────────────────────────────

let connectivityChannel: BroadcastChannel | null = null;

function getConnectivityChannel(): BroadcastChannel | null {
  if (typeof window === 'undefined') return null;
  if (!connectivityChannel) {
    try {
      connectivityChannel = new BroadcastChannel(CHANNELS.CONNECTIVITY);
    } catch {
      return null;
    }
  }
  return connectivityChannel;
}

function broadcastConnectivity(message: BroadcastConnectivityMessage): void {
  const channel = getConnectivityChannel();
  channel?.postMessage(message);
}

// ─── Connectivity Monitor Class ───────────────────────────────────────────────

type ConnectivityListener = (info: ConnectivityInfo) => void;

class ConnectivityMonitor {
  private state: ConnectivityState = 'online';
  private info: ConnectivityInfo;
  private listeners: Set<ConnectivityListener> = new Set();
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private timeoutTimestamps: number[] = [];
  private stateChangeDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  private isMonitoring = false;

  constructor() {
    this.info = {
      state: 'online',
      lastStateChange: Date.now(),
      isDegraded: false,
    };
  }

  /**
   * Start monitoring connectivity
   */
  start(): void {
    if (this.isMonitoring) return;
    if (typeof window === 'undefined') return;

    this.isMonitoring = true;

    // Set initial state
    this.state = navigator.onLine ? 'online' : 'offline';
    this.info.state = this.state;

    // Read Network Information API
    this.updateNetworkInfo();

    // Listen for online/offline events
    window.addEventListener('online', this.handleOnline);
    window.addEventListener('offline', this.handleOffline);

    // Listen for Network Information API changes
    const connection = this.getConnection();
    if (connection) {
      connection.addEventListener('change', this.handleConnectionChange);
    }

    // Listen for visibility changes (pause/resume heartbeat)
    document.addEventListener('visibilitychange', this.handleVisibilityChange);

    // Start heartbeat if online
    if (this.state === 'online') {
      this.startHeartbeat();
    }
  }

  /**
   * Stop monitoring
   */
  stop(): void {
    if (!this.isMonitoring) return;

    this.isMonitoring = false;
    this.stopHeartbeat();

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.stateChangeDebounceTimer) {
      clearTimeout(this.stateChangeDebounceTimer);
      this.stateChangeDebounceTimer = null;
    }

    if (typeof window !== 'undefined') {
      window.removeEventListener('online', this.handleOnline);
      window.removeEventListener('offline', this.handleOffline);
      document.removeEventListener('visibilitychange', this.handleVisibilityChange);

      const connection = this.getConnection();
      if (connection) {
        connection.removeEventListener('change', this.handleConnectionChange);
      }
    }
  }

  /**
   * Get current connectivity info
   */
  getInfo(): ConnectivityInfo {
    return { ...this.info };
  }

  /**
   * Get current state
   */
  getState(): ConnectivityState {
    return this.state;
  }

  /**
   * Subscribe to connectivity changes
   */
  onChange(listener: ConnectivityListener): () => void {
    this.listeners.add(listener);
    // Immediately notify with current state
    listener({ ...this.info });
    return () => this.listeners.delete(listener);
  }

  /**
   * Force a connectivity check
   */
  async check(): Promise<ConnectivityInfo> {
    await this.performHeartbeat();
    return this.getInfo();
  }

  // ─── Event Handlers ───────────────────────────────────────────────────────

  private handleOnline = (): void => {
    // Debounce state transition to avoid flickering
    this.debouncedStateChange('reconnecting');

    // Verify actual connectivity with heartbeat
    void this.performHeartbeat().then((isActuallyOnline) => {
      if (isActuallyOnline) {
        this.transition('online');
        // Trigger sync when coming back online
        void processSyncQueue();
      } else {
        this.transition('liefi');
      }
    });
  };

  private handleOffline = (): void => {
    this.transition('offline');
  };

  private handleConnectionChange = (): void => {
    this.updateNetworkInfo();

    const connection = this.getConnection();
    if (connection) {
      // Check for degraded connection
      if (connection.rtt && connection.rtt > DEGRADED_RTT_THRESHOLD) {
        this.info.isDegraded = true;
        if (connection.rtt > LIEFI_RTT_THRESHOLD) {
          this.debouncedStateChange('liefi');
        }
      } else {
        this.info.isDegraded = false;
      }

      this.notifyListeners();
    }
  };

  private handleVisibilityChange = (): void => {
    if (document.visibilityState === 'visible') {
      // Resume heartbeat when tab becomes visible
      if (this.state !== 'offline') {
        this.startHeartbeat();
        // Immediate check on focus
        void this.performHeartbeat();
      }
    } else {
      // Reduce activity when hidden
      this.stopHeartbeat();
    }
  };

  // ─── State Machine ────────────────────────────────────────────────────────

  private transition(newState: ConnectivityState): void {
    if (this.state === newState) return;

    this.state = newState;
    this.info.state = newState;
    this.info.lastStateChange = Date.now();

    // Start/stop heartbeat based on state
    if (newState === 'offline') {
      this.stopHeartbeat();
      this.startReconnectPolling();
    } else if (newState === 'online') {
      this.startHeartbeat();
      this.stopReconnectPolling();
      this.info.lastSuccessfulRequest = Date.now();
      this.info.isDegraded = false;
    } else if (newState === 'liefi') {
      // Keep heartbeat running to detect recovery
      this.info.isDegraded = true;
    } else if (newState === 'reconnecting') {
      // Transitional state
    }

    this.notifyListeners();

    broadcastConnectivity({
      type: 'state-change',
      payload: { ...this.info },
      timestamp: Date.now(),
    });
  }

  private debouncedStateChange(newState: ConnectivityState): void {
    if (this.stateChangeDebounceTimer) {
      clearTimeout(this.stateChangeDebounceTimer);
    }

    // Immediate transition for offline
    if (newState === 'offline') {
      this.transition(newState);
      return;
    }

    // Debounce other transitions to avoid flicker
    this.stateChangeDebounceTimer = setTimeout(() => {
      this.transition(newState);
      this.stateChangeDebounceTimer = null;
    }, 500);
  }

  // ─── Heartbeat ────────────────────────────────────────────────────────────

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      void this.performHeartbeat();
    }, HEARTBEAT_INTERVAL);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private async performHeartbeat(): Promise<boolean> {
    if (typeof navigator === 'undefined' || !navigator.onLine) {
      return false;
    }

    const startTime = performance.now();

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(HEARTBEAT_ENDPOINT, {
        method: 'HEAD',
        cache: 'no-store',
        signal: controller.signal,
      });

      clearTimeout(timeout);

      const rtt = performance.now() - startTime;
      this.info.rtt = Math.round(rtt);

      if (response.ok) {
        this.info.lastSuccessfulRequest = Date.now();

        // Check if RTT indicates degraded connection
        if (rtt > LIEFI_RTT_THRESHOLD) {
          if (this.state !== 'liefi') {
            this.transition('liefi');
          }
          return false;
        }

        if (rtt > DEGRADED_RTT_THRESHOLD) {
          this.info.isDegraded = true;
        } else {
          this.info.isDegraded = false;
        }

        // We're actually online
        if (this.state !== 'online') {
          this.transition('online');
          void processSyncQueue();
        }

        this.notifyListeners();

        broadcastConnectivity({
          type: 'heartbeat-result',
          payload: { ...this.info },
          timestamp: Date.now(),
        });

        return true;
      }

      return false;
    } catch {
      // Request failed - track timeout
      this.recordTimeout();
      return false;
    }
  }

  // ─── Lie-fi Detection ─────────────────────────────────────────────────────

  private recordTimeout(): void {
    const now = Date.now();
    this.timeoutTimestamps.push(now);

    // Remove timestamps outside the window
    this.timeoutTimestamps = this.timeoutTimestamps.filter((t) => now - t < LIEFI_TIMEOUT_WINDOW);

    // Check if we've hit the threshold
    if (this.timeoutTimestamps.length >= LIEFI_TIMEOUT_COUNT) {
      if (this.state === 'online' || this.state === 'reconnecting') {
        this.transition('liefi');

        broadcastConnectivity({
          type: 'liefi-detected',
          payload: { ...this.info },
          timestamp: Date.now(),
        });
      }
    }
  }

  // ─── Reconnect Polling ────────────────────────────────────────────────────

  private reconnectAttempt = 0;

  private startReconnectPolling(): void {
    this.stopReconnectPolling();
    this.reconnectAttempt = 0;
    this.scheduleReconnect();
  }

  private stopReconnectPolling(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.reconnectAttempt = 0;
  }

  private scheduleReconnect(): void {
    // Exponential backoff: 2s, 4s, 8s, 16s, max 30s
    const delay = Math.min(2000 * 2 ** this.reconnectAttempt, 30000);

    this.reconnectTimer = setTimeout(async () => {
      this.reconnectAttempt++;

      if (navigator.onLine) {
        const isOnline = await this.performHeartbeat();
        if (isOnline) {
          this.transition('online');
          void processSyncQueue();
          return;
        }
      }

      // Schedule next attempt
      this.scheduleReconnect();
    }, delay);
  }

  // ─── Utilities ────────────────────────────────────────────────────────────

  private getConnection(): NetworkInformation | undefined {
    if (typeof navigator === 'undefined') return undefined;
    const nav = navigator as NavigatorWithConnection;
    return nav.connection || nav.mozConnection || nav.webkitConnection;
  }

  private updateNetworkInfo(): void {
    const connection = this.getConnection();
    if (connection) {
      this.info.effectiveType = connection.effectiveType;
      this.info.rtt = connection.rtt;
      this.info.downlink = connection.downlink;
      this.info.saveData = connection.saveData;
    }
  }

  private notifyListeners(): void {
    const infoCopy = { ...this.info };
    for (const listener of this.listeners) {
      try {
        listener(infoCopy);
      } catch {
        // Don't let listener errors break monitoring
      }
    }
  }
}

// ─── Singleton Instance ───────────────────────────────────────────────────────

let monitorInstance: ConnectivityMonitor | null = null;

export function getConnectivityMonitor(): ConnectivityMonitor {
  if (!monitorInstance) {
    monitorInstance = new ConnectivityMonitor();
  }
  return monitorInstance;
}

/**
 * Start connectivity monitoring
 * Should be called once at app initialization
 */
export function startConnectivityMonitoring(): ConnectivityMonitor {
  const monitor = getConnectivityMonitor();
  monitor.start();
  return monitor;
}

/**
 * Stop connectivity monitoring
 */
export function stopConnectivityMonitoring(): void {
  monitorInstance?.stop();
}

/**
 * Get current connectivity state
 */
export function getConnectivityState(): ConnectivityState {
  return getConnectivityMonitor().getState();
}

/**
 * Get full connectivity info
 */
export function getConnectivityInfo(): ConnectivityInfo {
  return getConnectivityMonitor().getInfo();
}

/**
 * Subscribe to connectivity changes
 */
export function onConnectivityChange(listener: ConnectivityListener): () => void {
  return getConnectivityMonitor().onChange(listener);
}

/**
 * Force a connectivity check (useful after user interaction)
 */
export async function checkConnectivity(): Promise<ConnectivityInfo> {
  return getConnectivityMonitor().check();
}
