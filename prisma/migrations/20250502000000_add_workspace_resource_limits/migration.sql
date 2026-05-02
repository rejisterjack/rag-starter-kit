-- Migration: add_workspace_resource_limits
-- Adds per-workspace resource limits and LLM configuration fields

-- Resource limit fields
ALTER TABLE "workspaces" ADD COLUMN "maxDocuments" INTEGER NOT NULL DEFAULT 100;
ALTER TABLE "workspaces" ADD COLUMN "maxStorageMb" INTEGER NOT NULL DEFAULT 1024;
ALTER TABLE "workspaces" ADD COLUMN "maxChats" INTEGER NOT NULL DEFAULT 1000;
ALTER TABLE "workspaces" ADD COLUMN "maxChatPerDay" INTEGER NOT NULL DEFAULT 50;

-- Per-workspace LLM configuration
ALTER TABLE "workspaces" ADD COLUMN "llmProvider" TEXT;
ALTER TABLE "workspaces" ADD COLUMN "llmModel" TEXT;
