/**
 * Plugin System Architecture
 * Allows third-party extensions
 */

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
    'chat:beforeSend'?: (message: string) => Promise<string> | string;
    'chat:afterReceive'?: (response: string) => Promise<string> | string;
    'chat:onError'?: (error: Error) => Promise<void>;
    
    // Document hooks
    'document:beforeIngest'?: (content: string, metadata: any) => Promise<{ content: string; metadata: any }>;
    'document:afterIngest'?: (documentId: string) => Promise<void>;
    
    // UI hooks
    'ui:toolbar'?: () => React.ComponentType;
    'ui:sidebar'?: () => React.ComponentType;
    'ui:settings'?: () => React.ComponentType;
  };
  
  // Settings schema
  settings?: Record<string, {
    type: 'string' | 'number' | 'boolean' | 'select';
    label: string;
    description?: string;
    default?: unknown;
    options?: string[]; // for select type
  }>;
}

export class PluginManager {
  private plugins: Map<string, Plugin> = new Map();
  private hooks: Map<string, Function[]> = new Map();
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
      if (handler) {
        this.addHook(hookName, handler);
      }
    }

    // Initialize settings
    const defaultSettings: Record<string, unknown> = {};
    if (plugin.settings) {
      for (const [key, setting] of Object.entries(plugin.settings)) {
        defaultSettings[key] = setting.default;
      }
    }
    this.settings.set(plugin.id, defaultSettings);

    // Store plugin
    this.plugins.set(plugin.id, plugin);

    // Call install hook
    if (plugin.onInstall) {
      await plugin.onInstall();
    }

    console.log(`Plugin registered: ${plugin.name} v${plugin.version}`);
  }

  /**
   * Unregister a plugin
   */
  async unregister(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) return;

    // Call uninstall hook
    if (plugin.onUninstall) {
      await plugin.onUninstall();
    }

    // Remove hooks
    for (const hookName of Object.keys(plugin.hooks)) {
      this.removeHook(hookName, plugin.hooks[hookName as keyof typeof plugin.hooks] as Function);
    }

    this.plugins.delete(pluginId);
    this.settings.delete(pluginId);
  }

  /**
   * Enable a plugin
   */
  async enable(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) throw new Error(`Plugin ${pluginId} not found`);

    if (plugin.onEnable) {
      await plugin.onEnable();
    }
  }

  /**
   * Disable a plugin
   */
  async disable(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) throw new Error(`Plugin ${pluginId} not found`);

    if (plugin.onDisable) {
      await plugin.onDisable();
    }
  }

  /**
   * Add a hook handler
   */
  private addHook(name: string, handler: Function): void {
    if (!this.hooks.has(name)) {
      this.hooks.set(name, []);
    }
    this.hooks.get(name)!.push(handler);
  }

  /**
   * Remove a hook handler
   */
  private removeHook(name: string, handler: Function): void {
    const handlers = this.hooks.get(name);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  /**
   * Execute hooks
   */
  async executeHook<T>(name: string, data: T): Promise<T> {
    const handlers = this.hooks.get(name) || [];
    let result = data;

    for (const handler of handlers) {
      try {
        result = await handler(result);
      } catch (error) {
        console.error(`Hook ${name} failed:`, error);
      }
    }

    return result;
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
    const current = this.settings.get(pluginId) || {};
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
