# Architecture Documentation

## System Architecture

```mermaid
graph TB
    subgraph Client["Client Layer"]
        Browser["Web Browser"]
        Mobile["Mobile App"]
        API["API Clients"]
    end

    subgraph Edge["Edge Layer"]
        CDN["CDN / Vercel Edge"]
        Middleware["Next.js Middleware"]
    end

    subgraph Application["Application Layer"]
        NextApp["Next.js App Router"]
        APIRoutes["API Routes"]
        Components["React Components"]
    end

    subgraph Services["Service Layer"]
        Auth["Auth Service"]
        RAG["RAG Engine"]
        Chat["Chat Service"]
        Ingest["Document Ingestion"]
        Export["Export Service"]
    end

    subgraph AI["AI Layer"]
        OpenAI["OpenAI"]
        Gemini["Google Gemini"]
        Local["Local Models"]
    end

    subgraph Data["Data Layer"]
        Postgres[("PostgreSQL + pgvector")]
        Redis[("Redis")]
        Cloudinary[("Cloudinary")]
    end

    Browser --> CDN
    Mobile --> CDN
    API --> Middleware
    CDN --> Middleware
    Middleware --> NextApp
    NextApp --> Components
    NextApp --> APIRoutes
    APIRoutes --> Auth
    APIRoutes --> RAG
    APIRoutes --> Chat
    APIRoutes --> Ingest
    APIRoutes --> Export
    RAG --> AI
    Chat --> AI
    Ingest --> AI
    Auth --> Postgres
    RAG --> Postgres
    Chat --> Postgres
    Auth --> Redis
    RAG --> Redis
    Ingest --> Cloudinary
    Export --> Cloudinary
```

## RAG Pipeline Architecture

```mermaid
sequenceDiagram
    participant User
    participant API as API Route
    participant RAG as RAG Engine
    participant Embed as Embedding Provider
    participant Vector as Vector Store
    participant LLM as LLM Provider

    User->>API: Send message
    API->>RAG: generateRAGResponse()
    
    RAG->>Embed: embedQuery(message)
    Embed-->>RAG: query vector
    
    RAG->>Vector: similaritySearch(query, topK=5)
    Vector-->>RAG: relevant chunks
    
    RAG->>RAG: buildContext(chunks)
    RAG->>RAG: buildSystemPrompt(context)
    
    RAG->>LLM: generate(systemPrompt + message)
    LLM-->>RAG: response
    
    RAG-->>API: {answer, sources, tokens}
    API-->>User: Return response with citations
```

## Security Flow

```mermaid
sequenceDiagram
    participant Client
    participant Middleware as Security Middleware
    participant Rate as Rate Limiter
    participant CSRF as CSRF Validator
    participant Auth as Auth Service
    participant Handler as Route Handler

    Client->>Middleware: Request
    Middleware->>Rate: checkRateLimit()
    Rate-->>Middleware: allowed?
    
    alt Rate limited
        Rate-->>Client: 429 Too Many Requests
    else Continue
        Middleware->>CSRF: validateCsrfToken()
        CSRF-->>Middleware: valid?
        
        alt Invalid CSRF
            CSRF-->>Client: 403 Forbidden
        else Continue
            Middleware->>Auth: verifyAuth()
            Auth-->>Middleware: user context
            
            alt Not authenticated
                Auth-->>Client: 401 Unauthorized
            else Continue
                Middleware->>Handler: Forward with context
                Handler-->>Client: Response
            end
        end
    end
```

## Database Schema (Simplified)

```mermaid
erDiagram
    USER ||--o{ WORKSPACE_MEMBER : belongs_to
    USER ||--o{ API_KEY : owns
    USER {
        string id PK
        string email
        string password_hash
        string name
        string role
        datetime created_at
    }
    
    WORKSPACE ||--o{ WORKSPACE_MEMBER : has
    WORKSPACE ||--o{ DOCUMENT : contains
    WORKSPACE ||--o{ CONVERSATION : contains
    WORKSPACE {
        string id PK
        string name
        string slug
        string owner_id FK
        json settings
    }
    
    WORKSPACE_MEMBER {
        string id PK
        string user_id FK
        string workspace_id FK
        string role
        string status
    }
    
    DOCUMENT ||--o{ CHUNK : has
    DOCUMENT {
        string id PK
        string workspace_id FK
        string name
        string type
        string status
        int size
    }
    
    CHUNK {
        string id PK
        string document_id FK
        text content
        vector embedding
        json metadata
    }
    
    CONVERSATION ||--o{ MESSAGE : contains
    CONVERSATION {
        string id PK
        string workspace_id FK
        string user_id FK
        string title
        string model
    }
    
    MESSAGE {
        string id PK
        string conversation_id FK
        string role
        text content
        json sources
        json metadata
    }
    
    API_KEY {
        string id PK
        string user_id FK
        string workspace_id FK
        string key_hash
        string key_preview
        json permissions
        datetime expires_at
    }
```

## Deployment Architecture

```mermaid
graph TB
    subgraph Production["Production Environment"]
        LB["Load Balancer"]
        
        subgraph AppServers["Application Servers"]
            App1["Next.js Instance 1"]
            App2["Next.js Instance 2"]
            App3["Next.js Instance 3"]
        end
        
        subgraph DataLayer["Data Layer"]
            PG[("PostgreSQL Primary")]
            PGRep[("PostgreSQL Replica")]
            RedisCluster[("Redis Cluster")]
            Cloudinary[("Cloudinary")]
        end
        
        subgraph Workers["Background Workers"]
            Inngest["Inngest Workers"]
        end
    end
    
    LB --> App1
    LB --> App2
    LB --> App3
    
    App1 --> PG
    App2 --> PG
    App3 --> PG
    
    PG --> PGRep
    App1 --> RedisCluster
    App1 --> Cloudinary
    App1 --> Inngest
```

## Component Hierarchy

```mermaid
graph TD
    Layout["Root Layout"] --> Providers["Providers"]
    Providers --> AuthProvider["Auth Provider"]
    Providers --> ThemeProvider["Theme Provider"]
    Providers --> QueryProvider["Query Provider"]
    
    AuthProvider --> ChatLayout["Chat Layout"]
    AuthProvider --> AdminLayout["Admin Layout"]
    AuthProvider --> AuthLayout["Auth Layout"]
    
    ChatLayout --> ChatContainer["Chat Container"]
    ChatContainer --> MessageList["Message List"]
    ChatContainer --> MessageInput["Message Input"]
    ChatContainer --> SourcesPanel["Sources Panel"]
    
    MessageList --> MessageItem["Message Item"]
    MessageItem --> CitationList["Citation List"]
    MessageItem --> Markdown["Markdown Renderer"]
    
    ChatLayout --> DocumentList["Document List"]
    DocumentList --> DocumentCard["Document Card"]
```

## Technology Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 15, React 19, TypeScript |
| Styling | Tailwind CSS 4, shadcn/ui |
| State | React Query, Zustand |
| Backend | Next.js API Routes, tRPC |
| Database | PostgreSQL 16 + pgvector |
| Cache | Redis |
| Storage | Cloudinary |
| AI | Vercel AI SDK, OpenRouter |
| Auth | NextAuth v5 |
| Queue | Inngest |
| Real-time | Socket.io |
