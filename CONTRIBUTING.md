# Contributing to RAG Starter Kit

Thank you for your interest in contributing to RAG Starter Kit! This document provides guidelines and instructions for contributing.

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Pull Request Process](#pull-request-process)
- [Coding Standards](#coding-standards)
- [Testing](#testing)
- [Documentation](#documentation)

## 🤝 Code of Conduct

This project and everyone participating in it is governed by our commitment to:

- Be respectful and inclusive
- Welcome newcomers and help them learn
- Focus on constructive feedback
- Accept responsibility and apologize when mistakes happen

## 🚀 Getting Started

### Prerequisites

- Node.js 20+
- pnpm 9+
- Docker & Docker Compose (optional but recommended)
- Git

### Setup

1. **Fork and clone the repository**
   ```bash
   git clone https://github.com/your-username/rag-starter-kit.git
   cd rag-starter-kit
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.local.example .env.local
   # Edit .env.local with your values
   ```

4. **Start the development environment**
   ```bash
   # Option A: With Docker (recommended)
   make up
   
   # Option B: Local development (requires PostgreSQL)
   pnpm dev
   ```

## 🔄 Development Workflow

1. **Create a branch**
   ```bash
   git checkout -b feature/your-feature-name
   # or
   git checkout -b fix/issue-description
   ```

2. **Make your changes**
   - Write clean, maintainable code
   - Follow the existing code style
   - Add tests for new features
   - Update documentation as needed

3. **Run checks locally**
   ```bash
   # Lint and format
   pnpm lint
   pnpm format
   
   # Type check
   pnpm type-check
   
   # Run tests
   pnpm test:run
   ```

4. **Commit your changes**
   ```bash
   git add .
   git commit -m "feat: add amazing feature"
   ```

   Follow [Conventional Commits](https://www.conventionalcommits.org/):
   - `feat:` New feature
   - `fix:` Bug fix
   - `docs:` Documentation changes
   - `style:` Code style changes (formatting, etc.)
   - `refactor:` Code refactoring
   - `test:` Adding or updating tests
   - `chore:` Maintenance tasks

## 📤 Pull Request Process

1. **Update your branch**
   ```bash
   git fetch origin
   git rebase origin/main
   ```

2. **Push to your fork**
   ```bash
   git push origin feature/your-feature-name
   ```

3. **Create a Pull Request**
   - Fill out the PR template completely
   - Link any related issues
   - Add screenshots for UI changes
   - Ensure all CI checks pass

4. **Code Review**
   - Address review comments promptly
   - Be open to feedback and suggestions
   - Ask questions if anything is unclear

5. **Merge**
   - Maintainers will merge once approved
   - Your contribution will be celebrated! 🎉

## 📝 Coding Standards

### TypeScript

- Use strict TypeScript mode
- Define explicit return types for functions
- Avoid `any` types - use `unknown` with type guards
- Use interfaces for object shapes, types for unions

```typescript
// ✅ Good
interface User {
  id: string;
  email: string;
}

function getUser(id: string): Promise<User | null> {
  // implementation
}

// ❌ Bad
function getUser(id: any): any {
  // implementation
}
```

### React Components

- Use functional components with hooks
- Follow the existing component structure
- Use React.memo for performance when needed
- Keep components focused and single-purpose

```typescript
// ✅ Good
interface ButtonProps {
  children: React.ReactNode;
  onClick: () => void;
  variant?: 'primary' | 'secondary';
}

export function Button({ children, onClick, variant = 'primary' }: ButtonProps): React.ReactElement {
  return <button className={variant} onClick={onClick}>{children}</button>;
}
```

### Styling

- Use Tailwind CSS utility classes
- Follow the existing color scheme and design tokens
- Use the `cn()` utility for conditional classes
- Maintain responsive design

```tsx
// ✅ Good
import { cn } from '@/lib/utils';

<div className={cn(
  'rounded-lg px-4 py-2',
  variant === 'primary' && 'bg-primary text-white',
  variant === 'secondary' && 'bg-secondary text-gray-900',
  isLoading && 'opacity-50 cursor-not-allowed'
)} />
```

## 🧪 Testing

### Unit Tests

```bash
# Run unit tests
pnpm test:unit

# Run with coverage
pnpm test:coverage
```

### Integration Tests

```bash
pnpm test:integration
```

### E2E Tests

```bash
# Start the dev server first
pnpm dev

# Run Playwright tests
pnpm test:e2e
```

### Writing Tests

- Test behavior, not implementation
- Use descriptive test names
- Follow the Arrange-Act-Assert pattern
- Mock external dependencies

```typescript
// ✅ Good
describe('UserService', () => {
  it('should create a new user with valid data', async () => {
    // Arrange
    const userData = { email: 'test@example.com', password: 'password123' };
    
    // Act
    const result = await createUser(userData);
    
    // Assert
    expect(result.email).toBe(userData.email);
    expect(result.id).toBeDefined();
  });
});
```

## 📚 Documentation

- Update README.md if adding new features
- Add JSDoc comments for public APIs
- Update CHANGELOG.md with your changes
- Include examples for complex features

## 🐛 Reporting Bugs

1. Check if the bug already exists in [issues](../../issues)
2. Create a new issue with:
   - Clear title and description
   - Steps to reproduce
   - Expected vs actual behavior
   - Screenshots if applicable
   - Environment details (OS, Node version, etc.)

## 💡 Feature Requests

1. Check existing [issues](../../issues) and [discussions](../../discussions)
2. Create a new issue with:
   - Clear use case description
   - Proposed solution (if you have one)
   - Alternatives considered
   - Willingness to contribute the feature

## 🏆 Recognition

Contributors will be:
- Listed in the README.md (with permission)
- Mentioned in release notes
- Celebrated in our community!

## 📞 Questions?

- Open a [Discussion](../../discussions)
- Join our community Discord (coming soon)
- Email: [your-email@example.com]

Thank you for contributing to RAG Starter Kit! 🚀
