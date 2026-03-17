# Testing Suite for RAG Starter Kit

This directory contains a comprehensive testing suite for the RAG chatbot application.

## 📁 Directory Structure

```
tests/
├── unit/                    # Unit tests
│   ├── components/          # React component tests
│   ├── hooks/               # Custom hook tests
│   └── lib/                 # Utility function tests
├── integration/             # Integration tests
│   └── api/                 # API route tests
├── e2e/                     # End-to-end tests (Playwright)
├── evaluation/              # RAG quality evaluation tests
├── performance/             # Load and performance tests
├── utils/                   # Test utilities
│   ├── mocks/               # Mock implementations
│   ├── fixtures/            # Test data
│   └── helpers/             # Test helpers
├── setup.ts                 # Test setup file
└── README.md                # This file
```

## 🚀 Quick Start

### Install Dependencies

```bash
pnpm install
```

### Run All Tests

```bash
# Run all tests (unit + e2e)
pnpm test:all
```

## 🧪 Unit Tests

Unit tests use **Vitest** with **React Testing Library**.

```bash
# Run all unit tests
pnpm test

# Run in watch mode
pnpm test:watch

# Run with UI
pnpm test:ui

# Run with coverage
pnpm test:coverage

# Run specific test file
pnpm test tests/unit/lib/chunking.test.ts
```

### Unit Test Structure

- **Components**: Test UI rendering, interactions, and accessibility
- **Hooks**: Test state management and side effects
- **Lib**: Test utility functions and business logic

## 🔗 Integration Tests

Integration tests verify that different parts of the application work together correctly.

```bash
# Run integration tests
pnpm test:integration

# Run specific integration test
pnpm test tests/integration/ingestion.test.ts
```

## 🎭 E2E Tests

E2E tests use **Playwright** to test the complete user journey.

```bash
# Run all E2E tests
pnpm test:e2e

# Run with UI for debugging
pnpm test:e2e:ui

# Run specific browser
pnpm test:e2e:chrome
pnpm test:e2e:firefox

# Run headed (visible browser)
pnpm test:e2e:headed

# Debug mode
pnpm test:e2e:debug
```

### E2E Test Structure

- **auth.spec.ts**: Authentication flows (login, signup, logout)
- **chat.spec.ts**: Chat functionality
- **documents.spec.ts**: Document upload and management
- **workspaces.spec.ts**: Workspace management

## 📊 RAG Evaluation Tests

These tests evaluate the quality of the RAG pipeline using metrics inspired by RAGAS.

```bash
# Run RAG evaluation tests
pnpm test:evaluation
```

### Metrics Measured

- **Retrieval Recall**: % of relevant documents retrieved
- **Retrieval Precision**: % of retrieved documents that are relevant
- **Mean Reciprocal Rank (MRR)**: Average rank of first relevant document
- **NDCG**: Normalized Discounted Cumulative Gain
- **Answer Relevance**: Semantic similarity to expected answer
- **Faithfulness**: Are claims supported by retrieved context?

## ⚡ Performance Tests

Performance tests use **k6** and **Artillery** for load testing.

```bash
# Run k6 load test
pnpm test:perf

# Run Artillery load test
pnpm test:perf:artillery
```

### Test Scenarios

- **Smoke Test**: Minimal load to verify functionality
- **Load Test**: Normal expected load
- **Stress Test**: Find breaking point
- **Spike Test**: Sudden traffic increase
- **Soak Test**: Prolonged load for memory leak detection

## 🛠️ Test Utilities

### Mocks

- **prisma.ts**: Mock Prisma client for database operations
- **openai.ts**: Mock OpenAI API for embeddings and completions

### Fixtures

- **documents.ts**: Sample documents for testing
- **chunks.ts**: Sample text chunks for testing

### Helpers

- **setup.ts**: Test setup helpers and common mocks

## 📈 Coverage

The test suite aims for:

- **90%+** code coverage
- **100%** coverage on critical paths
- All API endpoints tested
- All user flows covered by E2E tests

View coverage report:

```bash
pnpm test:coverage
# Then open coverage/index.html
```

## 🔧 Configuration

### Vitest Configuration

See `vitest.config.ts` for unit and integration test configuration.

### Playwright Configuration

See `playwright.config.ts` for E2E test configuration.

### Environment Variables

Copy `.env.test.example` to `.env.test` and configure for your test environment.

## 📝 Writing Tests

### Unit Test Example

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Button } from '@/components/ui/button';

describe('Button', () => {
  it('renders correctly', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });
});
```

### E2E Test Example

```typescript
import { test, expect } from '@playwright/test';

test('user can login', async ({ page }) => {
  await page.goto('/login');
  await page.fill('[data-testid="email-input"]', 'user@example.com');
  await page.fill('[data-testid="password-input"]', 'password');
  await page.click('[data-testid="login-button"]');
  await expect(page).toHaveURL('/dashboard');
});
```

## 🔄 CI/CD Integration

The testing suite is designed to work with GitHub Actions. See `.github/workflows/test.yml`.

## 🐛 Debugging

### Unit Tests

```bash
# Run with debugger
pnpm test --inspect-brk

# Run specific test with only flag
pnpm test -- --grep="Button"
```

### E2E Tests

```bash
# Run in debug mode
pnpm test:e2e:debug

# Run with Playwright inspector
npx playwright test --debug
```

## 📚 Best Practices

1. **Write tests first** (TDD) when possible
2. **Test behavior, not implementation**
3. **Use data-testid** for E2E selectors
4. **Mock external dependencies** in unit tests
5. **Keep tests independent** and isolated
6. **Use descriptive test names** that explain what is being tested
7. **Group related tests** with describe blocks
8. **Clean up after tests** using afterEach/afterAll

## 🆘 Troubleshooting

### Common Issues

**Tests failing in CI but passing locally**
- Check for race conditions
- Ensure tests are independent
- Increase timeouts if needed

**Playwright browser installation issues**
```bash
npx playwright install
```

**Prisma client not found**
```bash
pnpm db:generate
```

**Coverage not generating**
```bash
# Ensure coverage directory exists
mkdir -p coverage
```

## 📄 License

This testing suite is part of the RAG Starter Kit project and follows the same license.
