/**
 * Plugin System Architecture
 * Allows third-party extensions
 */

import type { ComponentType } from 'react';
import { logger } from '@/lib/logger';

// Plugin hook handler types
type ChatBeforeSendHandler = (message: string) => Promise<string> | string;
type ChatAfterReceiveHandler = (response: string) => Promise<string> | string;
type ChatOnErrorHandler = (error: Error) => Promise<void>;

interface DocumentIngestData {
  content: string;
  metadata: Record<string, unknown>;
}

type DocumentBeforeIngestHandler = (
  content: string,
  metadata: Record<string, unknown>
) => Promise<DocumentIngestData> | DocumentIngestData;
type DocumentAfterIngestHandler = (documentId: string) => Promise<void>;
type UIComponentHandler = () => ComponentType;

// Union type for all hook handlers
type HookHandler =
  | ChatBeforeSendHandler
  | ChatAfterReceiveHandler
  | ChatOnErrorHandler
  | DocumentBeforeIngestHandler
  | DocumentAfterIngestHandler
  | UIComponentHandler;

export interface Plugin {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;

  // Lifecycle hooks
  onInstall?: () => Promise<void>;
  onUninstall?: () => Promise<void>;
  onEnable?: () => Promise<void>;
  onDisable?: () => Promise<void>;

  // Feature extensions
  hooks: {
    // Chat hooks
    'chat:beforeSend'?: ChatBeforeSendHandler;
    'chat:afterReceive'?: ChatAfterReceiveHandler;
    'chat:onError'?: ChatOnErrorHandler;

    // Document hooks
    'document:beforeIngest'?: DocumentBeforeIngestHandler;
    'document:afterIngest'?: DocumentAfterIngestHandler;

    // UI hooks
    'ui:toolbar'?: UIComponentHandler;
    'ui:sidebar'?: UIComponentHandler;
    'ui:settings'?: UIComponentHandler;
  };

  // Settings schema
  settings?: Record<
    string,
    {
      type: 'string' | 'number' | 'boolean' | 'select';
      label: string;
      description?: string;
      default?: unknown;
      options?: string[]; // for select type
    }
  >;
}

export class PluginManager {
  private plugins: Map<string, Plugin> = new Map();
  private hooks: Map<string, HookHandler[]> = new Map();
  private settings: Map<string, Record<string, unknown>> = new Map();

  /**
   * Register a plugin
   */
  async register(plugin: Plugin): Promise<void> {
    if (this.plugins.has(plugin.id)) {
      throw new Error(`Plugin ${plugin.id} is already registered`);
    }

    // Register hooks
    for (const [hookName, handler] of Object.entries(plugin.hooks)) {
      if (handler !== undefined) {
        this.addHook(hookName, handler);
      }
    }

    // Initialize settings
    const defaultSettings: Record<string, unknown> = {};
    if (plugin.settings !== undefined) {
      for (const [key, setting] of Object.entries(plugin.settings)) {
        defaultSettings[key] = setting.default;
      }
    }
    this.settings.set(plugin.id, defaultSettings);

    // Store plugin
    this.plugins.set(plugin.id, plugin);

    // Call install hook
    if (plugin.onInstall !== undefined) {
      await plugin.onInstall();
    }
  }

  /**
   * Unregister a plugin
   */
  async unregister(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    if (plugin === undefined) return;

    // Call uninstall hook
    if (plugin.onUninstall !== undefined) {
      await plugin.onUninstall();
    }

    // Remove hooks
    for (const hookName of Object.keys(plugin.hooks)) {
      const handler = plugin.hooks[hookName as keyof typeof plugin.hooks];
      if (handler !== undefined) {
        this.removeHook(hookName, handler);
      }
    }

    this.plugins.delete(pluginId);
    this.settings.delete(pluginId);
  }

  /**
   * Enable a plugin
   */
  async enable(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    if (plugin === undefined) throw new Error(`Plugin ${pluginId} not found`);

    if (plugin.onEnable !== undefined) {
      await plugin.onEnable();
    }
  }

  /**
   * Disable a plugin
   */
  async disable(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    if (plugin === undefined) throw new Error(`Plugin ${pluginId} not found`);

    if (plugin.onDisable !== undefined) {
      await plugin.onDisable();
    }
  }

  /**
   * Add a hook handler
   */
  private addHook(name: string, handler: HookHandler): void {
    const existingHooks = this.hooks.get(name);
    if (existingHooks === undefined) {
      this.hooks.set(name, [handler]);
    } else {
      existingHooks.push(handler);
    }
  }

  /**
   * Remove a hook handler
   */
  private removeHook(name: string, handler: HookHandler): void {
    const handlers = this.hooks.get(name);
    if (handlers !== undefined) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  /**
   * Execute hooks for chat hooks that take a single string argument
   */
  async executeHook(name: 'chat:beforeSend' | 'chat:afterReceive', data: string): Promise<string>;
  /**
   * Execute hooks for error handlers
   */
  async executeHook(name: 'chat:onError', data: Error): Promise<void>;
  /**
   * Execute hooks for document before ingest
   */
  async executeHook(
    name: 'document:beforeIngest',
    data: DocumentIngestData
  ): Promise<DocumentIngestData>;
  /**
   * Execute hooks for document after ingest
   */
  async executeHook(name: 'document:afterIngest', data: string): Promise<void>;
  /**
   * Execute hooks for UI components
   */
  async executeHook(
    name: 'ui:toolbar' | 'ui:sidebar' | 'ui:settings',
    data: null
  ): Promise<ComponentType | null>;
  /**
   * Execute hooks (generic implementation)
   */
  async executeHook<T>(name: string, data: T): Promise<T | undefined | ComponentType> {
    const handlers = this.hooks.get(name) ?? [];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let result: unknown = data;

    for (const handler of handlers) {
      try {
        if (
          name === 'document:beforeIngest' &&
          typeof result === 'object' &&
          result !== null &&
          'content' in result &&
          'metadata' in result
        ) {
          result = await (handler as DocumentBeforeIngestHandler)(
            (result as DocumentIngestData).content,
            (result as DocumentIngestData).metadata
          );
        } else {
          result = await (handler as (arg: unknown) => unknown)(result);
        }
      } catch (error: unknown) {
        logger.debug('Plugin hook handler failed', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return result as T;
  }

  /**
   * Get plugin settings
   */
  getSettings(pluginId: string): Record<string, unknown> | undefined {
    return this.settings.get(pluginId);
  }

  /**
   * Update plugin settings
   */
  updateSettings(pluginId: string, settings: Record<string, unknown>): void {
    const current = this.settings.get(pluginId) ?? {};
    this.settings.set(pluginId, { ...current, ...settings });
  }

  /**
   * List all plugins
   */
  listPlugins(): Plugin[] {
    return Array.from(this.plugins.values());
  }

  /**
   * Get plugin by ID
   */
  getPlugin(id: string): Plugin | undefined {
    return this.plugins.get(id);
  }
}

// Singleton instance
export const pluginManager = new PluginManager();

export default PluginManager;
