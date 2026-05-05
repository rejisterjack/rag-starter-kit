# Support

## 🆘 Getting Help

**Please do NOT open a GitHub Issue for support questions.** Issues are for confirmed bugs and accepted feature requests only. Using Issues for questions squeezes out bug reports and makes the tracker impossible to maintain.

---

## Where to Get Help

### 💬 GitHub Discussions (Recommended)
[github.com/rejisterjack/rag-starter-kit/discussions](https://github.com/rejisterjack/rag-starter-kit/discussions)

For all questions, use Discussions:

| Category | Use for |
|---|---|
| **Q&A** | "How do I configure Ollama?", "Why is my embedding failing?" |
| **Show and Tell** | Share what you built with the starter kit |
| **Ideas** | Suggest features or improvements |
| **Deployment Help** | Vercel, Railway, Render, self-hosted questions |

Responses are best-effort from the maintainer and community. Most questions get answered within 48 hours.

### 📖 Documentation

Before opening a Discussion, check:
- [README.md](./README.md) — setup, quick start, environment variables
- [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) — system design and component relationships
- [docs/SECURITY.md](./docs/SECURITY.md) — auth, rate limiting, security headers
- [docs/API.md](./docs/API.md) — API reference
- [ROADMAP.md](./ROADMAP.md) — what's built, what's planned, what's not happening

### 🐛 Found a Bug?

If you've confirmed it's a bug (not a configuration issue), [open a GitHub Issue](https://github.com/rejisterjack/rag-starter-kit/issues/new?template=bug_report.md). Include:
- Node.js and pnpm versions
- Relevant environment variables (redacted)
- Steps to reproduce
- Expected vs actual behaviour
- Error messages and stack traces

### 🔒 Security Vulnerabilities

**Do not open public Issues for security vulnerabilities.**

Report them via [GitHub Security Advisories](https://github.com/rejisterjack/rag-starter-kit/security/advisories/new). This allows coordinated disclosure before any public announcement.

---

## Common Issues

### Setup & Environment

| Symptom | Likely Cause | Fix |
|---|---|---|
| `Environment validation failed` | Missing required env var | Check the error message — it names the exact variable |
| `Prisma generate fails` | Schema mismatch | Run `pnpm prisma generate` then `pnpm prisma migrate dev` |
| Port 3000 in use | Another process | `lsof -i :3000` to find it, or set `PORT=3001` |
| `WebSocket not connecting` | URL mismatch | Set `NEXT_PUBLIC_APP_URL` to match your browser URL exactly |

### AI & Embeddings

| Symptom | Likely Cause | Fix |
|---|---|---|
| `Embedding errors` | API key quota exceeded | Check OpenRouter or Google AI Studio dashboard |
| `LLM timeout` | Model overloaded | Switch to a different free model via `DEFAULT_MODEL` env var |
| Empty responses | No documents in knowledge base | Upload documents in the Admin dashboard first |
| Hallucinated answers | Similarity threshold too low | Increase `SIMILARITY_THRESHOLD` (default: 0.7) |

### Uploads & Storage

| Symptom | Likely Cause | Fix |
|---|---|---|
| `Upload fails` | Missing Cloudinary credentials | Verify `CLOUDINARY_URL` or individual Cloudinary env vars |
| Document stuck in PENDING | Inngest not running | Run `npx inngest-cli@latest dev` or check `INNGEST_EVENT_KEY` |

---

## Enterprise & Commercial Support

If you need dedicated support, custom SLAs, or enterprise deployment assistance, see [/pricing](/pricing) or reach out via [GitHub Discussions](https://github.com/rejisterjack/rag-starter-kit/discussions).

---

*Maintained by [@rejisterjack](https://github.com/rejisterjack)*
