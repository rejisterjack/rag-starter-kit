# Video Script: 5-Minute Setup Walkthrough

## Overview
- **Title**: "Get Started with RAG Starter Kit in 5 Minutes"
- **Duration**: 5 minutes
- **Target Audience**: Developers new to the project
- **Goal**: Show complete setup from clone to working chat

---

## Scene 1: Introduction (30 seconds)

**Visual**: Project GitHub page → Screen recording of developer desktop

**Script**:
> "Hey developers! Today I'm going to show you how to get the RAG Starter Kit running locally in under 5 minutes. This is a production-ready chatbot that combines AI with your documents. And the best part? It's completely free to run using OpenRouter and Google Gemini."

**On-screen text**:
- RAG Starter Kit
- 100% FREE AI Setup
- 5 Minutes Setup

---

## Scene 2: Prerequisites (30 seconds)

**Visual**: Terminal showing version checks

**Script**:
> "First, make sure you have Node.js 20, pnpm, and Docker installed. Let's verify:"

```bash
# Terminal commands shown
node --version    # v20.x.x
pnpm --version    # 9.x.x
docker --version  # 24.x.x
```

> "If you don't have these, check the links in the description."

**On-screen text**:
- Node.js 20+
- pnpm 9+
- Docker

---

## Scene 3: Clone and Configure (1 minute)

**Visual**: Terminal commands

**Script**:
> "Now let's clone the repository and set it up:"

```bash
# Commands typed live
git clone https://github.com/rejisterjack/rag-starter-kit.git
cd rag-starter-kit
cp .env.example .env
```

> "We need two free API keys. First, let's get an OpenRouter key for the chat models."

**Visual**: Browser navigating to openrouter.ai/keys

**Script**:
> "Go to openrouter.ai/keys, create a free account, and copy your key."

**Visual**: Copy key, paste into .env file

```bash
# In .env file
OPENROUTER_API_KEY=sk-or-v1-your-key-here
```

**Script**:
> "Next, get a Google Gemini key for embeddings."

**Visual**: Browser navigating to aistudio.google.com/app/apikey

**Script**:
> "Visit Google AI Studio, create a new API key, and add it to your .env file:"

```bash
GOOGLE_API_KEY=AIzaSy-your-key-here
```

---

## Scene 4: Start the Application (1 minute)

**Visual**: Terminal, docker-compose up

**Script**:
> "Now for the magic. One command starts everything - PostgreSQL, Redis, MinIO, Inngest, and the Next.js app:"

```bash
docker-compose up
```

**Visual**: Docker containers starting up, logs scrolling

**Script**:
> "This downloads and starts all services. It takes about 2-3 minutes the first time."

**Visual**: Services starting message

```
[+] Running 6/6
 ⠿ Container rag-postgres    Started
 ⠿ Container rag-redis       Started
 ⠿ Container rag-minio       Started
 ⠿ Container rag-inngest     Started
 ⠿ Container rag-app         Started
```

> "While that's starting, let me show you what services are running:"

**On-screen graphic**:
| Service | Port | Purpose |
|---------|------|---------|
| Next.js App | 3000 | Main application |
| Prisma Studio | 5555 | Database GUI |
| Inngest | 8288 | Background jobs |
| MinIO | 9001 | File storage |

---

## Scene 5: First Run (1 minute)

**Visual**: Browser opening localhost:3000

**Script**:
> "Open your browser to localhost:3000. You'll see the landing page. Let's register an account:"

**Visual**: Clicking "Get Started", filling registration form

**Script**:
> "Create an account with email and password. The app automatically creates your first workspace."

**Visual**: Dashboard loads, showing chat interface

**Script**:
> "And we're in! This is your personal RAG chatbot. Let's test it by uploading a document."

---

## Scene 6: Upload and Chat (1 minute)

**Visual**: Clicking upload button, selecting a PDF file

**Script**:
> "Click the upload button and select any PDF. I'll use a sample annual report."

**Visual**: File uploads, processing indicator

**Script**:
> "The document is being processed in the background - extracting text, chunking it, and creating embeddings. This takes about 30 seconds."

**Visual**: Processing complete notification

**Script**:
> "Now let's ask a question about the document:"

**Visual**: Typing in chat: "What were the key findings?"

**Script**:
> "Type your question and hit send. The AI searches your document for relevant information and generates an answer with citations."

**Visual**: Streaming response appears with source citations

**Script**:
> "Notice the source citations? You can click them to see exactly where in the document the information came from."

---

## Scene 7: Wrap Up (30 seconds)

**Visual**: Quick montage of features - dark mode, multiple documents, settings

**Script**:
> "And that's it! In under 5 minutes, you have a fully functional RAG chatbot. You can upload multiple documents, switch between workspaces, customize the AI models, and even deploy to production."

**Visual**: Terminal showing one command

**Script**:
> "Everything runs locally with free AI models. When you're ready for production, check out our deployment guides for Vercel, Railway, or AWS."

**On-screen text**:
- ✓ Clone & configure
- ✓ Get free API keys
- ✓ Start with docker-compose
- ✓ Upload documents
- ✓ Start chatting!

> "Star the repo on GitHub and join our Discord for support. Happy building!"

**End screen**: GitHub link, Discord invite, documentation link

---

## Production Notes

### Screen Recording Tips
- Use clean terminal (no personal info)
- Increase font size for readability
- Use a screen recorder like OBS or ScreenFlow
- 1080p minimum resolution

### Editing
- Add zoom effects on important UI elements
- Use callouts for key commands
- Background music (low volume)
- Captions for accessibility

### Thumbnail Ideas
- Split screen: Terminal + Browser
- "5 min" badge
- "FREE AI" badge
- Before/After (empty → working chat)

---

## Call to Action

- Star on GitHub
- Join Discord
- Read full docs
- Subscribe for more tutorials
