// =============================================================================
// Workspace Types
// =============================================================================

export type MemberRole = 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';
export type MemberStatus = 'ACTIVE' | 'INACTIVE' | 'PENDING' | 'SUSPENDED';
export type WorkspacePlan = 'FREE' | 'PRO' | 'ENTERPRISE';
export type InvitationStatus = 'PENDING' | 'ACCEPTED' | 'EXPIRED' | 'CANCELLED';

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  avatar: string | null;
  ownerId: string;
  plan: WorkspacePlan;
  settings: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkspaceMember {
  id: string;
  workspaceId: string;
  userId: string;
  role: MemberRole;
  status: MemberStatus;
  permissions: Record<string, unknown> | null;
  invitedBy: string | null;
  invitedAt: Date | null;
  joinedAt: Date;
}

export interface WorkspaceInvitation {
  id: string;
  workspaceId: string;
  email: string;
  role: MemberRole;
  status: InvitationStatus;
  invitedBy: string;
  token: string;
  expiresAt: Date;
  createdAt: Date;
}

// =============================================================================
// API Response Types
// =============================================================================

export interface WorkspaceResponse {
  success: boolean;
  data?: Workspace;
  error?: {
    code: string;
    message: string;
  };
}

export interface WorkspacesListResponse {
  success: boolean;
  data: {
    workspaces: Workspace[];
    currentWorkspaceId?: string;
  };
}

export interface MembersListResponse {
  success: boolean;
  data: {
    members: (WorkspaceMember & {
      user: {
        id: string;
        name: string | null;
        email: string;
        image: string | null;
      };
    });
  };
}

// =============================================================================
// Settings Types
// =============================================================================

export interface WorkspaceSettings {
  // Chat settings
  defaultModel?: string;
  defaultTemperature?: number;
  maxTokens?: number;
  
  // RAG settings
  chunkSize?: number;
  chunkOverlap?: number;
  topK?: number;
  similarityThreshold?: number;
  
  // Security settings
  requireApproval?: boolean;
  allowedDomains?: string[];
  
  // Branding
  customLogo?: string;
  primaryColor?: string;
}
