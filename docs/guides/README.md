# Developer Guides

Step-by-step guides for working with the RAG Starter Kit.

## Available Guides

### Getting Started
- [Setup](./setup.md) - Complete development environment setup
- [Adding New Models](./adding-new-models.md) - Integrate custom LLM providers

### Customization
- [Customizing UI](./customizing-ui.md) - Theming, components, and styling

### Deployment
- [Deploying](./deploying.md) - Production deployment options (Vercel, Docker, AWS, etc.)

### Troubleshooting
- [Troubleshooting](./troubleshooting.md) - Common issues and solutions

## Quick Reference

### Development Commands

```bash
# Start development
pnpm dev

# Run tests
pnpm test

# Check code quality
pnpm check

# Database operations
pnpm db:migrate
pnpm db:studio
```

### Common Tasks

| Task | Command | Guide |
|------|---------|-------|
| Setup environment | `docker-compose up` | [Setup](./setup.md) |
| Add LLM provider | Create provider class | [Models](./adding-new-models.md) |
| Change theme | Edit CSS variables | [UI](./customizing-ui.md) |
| Deploy to Vercel | `vercel --prod` | [Deploy](./deploying.md) |
| Debug issues | Check logs | [Troubleshooting](./troubleshooting.md) |

## Need Help?

- Check the [API Documentation](../api/)
- Review [Architecture Decisions](../adr/)
- Read the [Main README](../../README.md)
- Open an issue on GitHub
