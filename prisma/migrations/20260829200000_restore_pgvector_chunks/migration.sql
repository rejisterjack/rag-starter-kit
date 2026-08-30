-- Restore document_chunks and image_embeddings on pgvector.
-- Text embeddings: vector(768). Image embeddings: vector(512).
-- Keyword search uses a generated tsvector column (not mapped in Prisma).

CREATE EXTENSION IF NOT EXISTS "vector";

CREATE TABLE "document_chunks" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workspaceId" TEXT,
    "content" TEXT NOT NULL,
    "embedding" vector(768),
    "index" INTEGER NOT NULL,
    "start" INTEGER NOT NULL DEFAULT 0,
    "end" INTEGER NOT NULL DEFAULT 0,
    "page" INTEGER,
    "section" TEXT,
    "documentName" TEXT NOT NULL DEFAULT '',
    "documentType" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_chunks_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "document_chunks"
  ADD COLUMN "content_tsv" tsvector
  GENERATED ALWAYS AS (to_tsvector('english', coalesce("content", ''))) STORED;

CREATE TABLE "image_embeddings" (
    "id" TEXT NOT NULL,
    "documentId" TEXT,
    "imageId" TEXT,
    "userId" TEXT,
    "imageUrl" TEXT,
    "storageUrl" TEXT,
    "contentHash" TEXT,
    "caption" TEXT,
    "pageNumber" INTEGER,
    "embedding" vector(512) NOT NULL,
    "model" TEXT NOT NULL DEFAULT 'Xenova/clip-vit-base-patch32',
    "dimensions" INTEGER NOT NULL DEFAULT 512,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "image_embeddings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "image_embeddings_contentHash_key" ON "image_embeddings"("contentHash");

CREATE INDEX "document_chunks_documentId_idx" ON "document_chunks"("documentId");
CREATE INDEX "document_chunks_userId_idx" ON "document_chunks"("userId");
CREATE INDEX "document_chunks_workspaceId_idx" ON "document_chunks"("workspaceId");
CREATE INDEX "document_chunks_userId_workspaceId_idx" ON "document_chunks"("userId", "workspaceId");
CREATE INDEX "document_chunks_documentType_idx" ON "document_chunks"("documentType");
CREATE INDEX "document_chunks_documentId_index_idx" ON "document_chunks"("documentId", "index");
CREATE INDEX "document_chunks_content_tsv_idx" ON "document_chunks" USING GIN ("content_tsv");
CREATE INDEX "document_chunks_embedding_hnsw_idx"
  ON "document_chunks"
  USING hnsw ("embedding" vector_cosine_ops)
  WITH (m = 32, ef_construction = 128);

CREATE INDEX "image_embeddings_documentId_idx" ON "image_embeddings"("documentId");
CREATE INDEX "image_embeddings_userId_idx" ON "image_embeddings"("userId");
CREATE INDEX "image_embeddings_imageId_idx" ON "image_embeddings"("imageId");
CREATE INDEX "image_embeddings_embedding_hnsw_idx"
  ON "image_embeddings"
  USING hnsw ("embedding" vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

CREATE INDEX "document_images_chunkId_idx" ON "document_images"("chunkId");

ALTER TABLE "document_chunks"
  ADD CONSTRAINT "document_chunks_documentId_fkey"
  FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "document_chunks"
  ADD CONSTRAINT "document_chunks_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "document_chunks"
  ADD CONSTRAINT "document_chunks_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "image_embeddings"
  ADD CONSTRAINT "image_embeddings_documentId_fkey"
  FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "document_images"
  ADD CONSTRAINT "document_images_chunkId_fkey"
  FOREIGN KEY ("chunkId") REFERENCES "document_chunks"("id") ON DELETE SET NULL ON UPDATE CASCADE;
