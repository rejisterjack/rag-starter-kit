# Architecture Decision Records (ADRs)

This directory contains Architecture Decision Records (ADRs) documenting the key technical decisions made in the RAG Starter Kit project.

## What are ADRs?

Architecture Decision Records capture important architectural decisions, their context, and consequences. They provide:

- **Transparency**: Why certain technologies were chosen
- **Context**: What alternatives were considered
- **History**: Evolution of the architecture over time
- **Onboarding**: Help new team members understand the system

## Format

Each ADR follows a standard format:
1. **Status**: Proposed, Accepted, Deprecated, Superseded
2. **Context**: What is the issue that we're seeing?
3. **Decision**: What is the change that we're proposing?
4. **Consequences**: What becomes easier or more difficult?

## Index

| ADR | Title | Status | Date |
|-----|-------|--------|------|
| [001](./001-why-nextjs.md) | Why Next.js was chosen | Accepted | March 2024 |
| [002](./002-database-choice.md) | PostgreSQL + pgvector decision | Accepted | March 2024 |
| [003](./003-ai-provider-strategy.md) | OpenRouter + Google Gemini | Accepted | March 2024 |
| [004](./004-authentication.md) | Auth architecture | Accepted | March 2024 |
| [005](./005-rag-pipeline.md) | RAG implementation decisions | Accepted | March 2024 |
| [006](./006-security.md) | Security architecture | Accepted | March 2024 |

## Contributing

When proposing a new architectural decision:

1. Create a new file following the naming convention: `XXX-short-description.md`
2. Use the template from existing ADRs
3. Start with status "Proposed"
4. After discussion, update to "Accepted" or "Rejected"
5. Link related ADRs in the "Related Decisions" section

## References

- [ADR GitHub Organization](https://adr.github.io/)
- [Documenting Architecture Decisions](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions)
- [MADR - Markdown ADR](https://adr.github.io/madr/)
