-- RAG Starter Kit - PostgreSQL Initialization
-- This script runs on first container startup to set up the database

-- Enable pgvector extension for vector similarity search
CREATE EXTENSION IF NOT EXISTS vector;

-- Verify pgvector extension is installed
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
        RAISE EXCEPTION 'pgvector extension failed to install';
    END IF;
    RAISE NOTICE 'pgvector extension installed successfully';
END $$;

-- Create schema for RAG application (if not using default public schema)
CREATE SCHEMA IF NOT EXISTS rag;

-- Set up search path
ALTER DATABASE ragdb SET search_path TO public, rag;

-- Create application user with limited privileges (optional, for production)
-- Note: This is commented out by default as the docker-compose uses the superuser
-- Uncomment and modify for production deployments with stricter security

-- CREATE USER rag_app WITH PASSWORD 'app_secure_password';
-- GRANT CONNECT ON DATABASE ragdb TO rag_app;
-- GRANT USAGE ON SCHEMA public TO rag_app;
-- GRANT USAGE ON SCHEMA rag TO rag_app;
-- GRANT CREATE ON SCHEMA public TO rag_app;
-- GRANT CREATE ON SCHEMA rag TO rag_app;

-- Grant privileges for Prisma migrations
-- ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO rag_app;
-- ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO rag_app;
-- ALTER DEFAULT PRIVILEGES IN SCHEMA rag GRANT ALL ON TABLES TO rag_app;
-- ALTER DEFAULT PRIVILEGES IN SCHEMA rag GRANT ALL ON SEQUENCES TO rag_app;

-- Create comments for documentation
COMMENT ON EXTENSION vector IS 'pgvector extension for vector similarity search - required for RAG embeddings storage';

-- Log completion
DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'RAG Starter Kit Database Initialized';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Database: %', current_database();
    RAISE NOTICE 'User: %', current_user;
    RAISE NOTICE 'Extensions:';
    RAISE NOTICE '  - vector: ENABLED';
    RAISE NOTICE 'Schemas:';
    RAISE NOTICE '  - public: EXISTS';
    RAISE NOTICE '  - rag: CREATED';
    RAISE NOTICE '========================================';
END $$;
