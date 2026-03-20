export interface WhiteLabelConfig {
  brandName: string;
  logoUrl?: string;
  primaryColor?: string;
  customDomain?: string;
  enabledFeatures?: string[];
}

export class WhiteLabelManager {
  async getConfig(_workspaceId?: string): Promise<WhiteLabelConfig> {
    return {
      brandName: 'RAG Starter Kit',
      primaryColor: '#3b82f6',
      enabledFeatures: ['chat', 'documents', 'analytics'],
    };
  }
}

export const whiteLabelManager = new WhiteLabelManager();
export default whiteLabelManager;
