-- Migration: add_chat_model_field
-- Adds the 'model' column to the 'chats' table to track which AI model was used

-- Add the model column as nullable (existing chats will have NULL)
ALTER TABLE "chats" ADD COLUMN "model" TEXT;

-- Create index for efficient filtering by model
CREATE INDEX "idx_chats_model" ON "chats"("model");

-- Add comment explaining the field
COMMENT ON COLUMN "chats"."model" IS 'The AI model identifier used for this chat (e.g., deepseek/deepseek-chat:free)';
