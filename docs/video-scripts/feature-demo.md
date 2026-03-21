# Video Script: Feature Demonstration

## Overview
- **Title**: "RAG Starter Kit: Full Feature Walkthrough"
- **Duration**: 10-12 minutes
- **Target Audience**: Evaluating users, potential contributors
- **Goal**: Showcase all major features and capabilities

---

## Scene 1: Introduction (1 minute)

**Visual**: Animated intro with logo, product shots

**Script**:
> "Welcome to the RAG Starter Kit - a production-ready, open-source chatbot that combines the power of AI with your documents. Today I'm going to show you every feature that makes this special, from intelligent document processing to real-time collaboration. And yes, it includes a completely free AI setup that costs zero dollars to run."

**On-screen**: Feature list appears
- 100% Free AI
- Document RAG
- Real-time Collaboration
- Enterprise Security
- Multi-tenant Workspaces

---

## Scene 2: Free AI Setup (2 minutes)

**Visual**: Split screen showing API key pages

**Script**:
> "Let's start with the most unique feature - a completely free AI stack. Most RAG solutions require paid OpenAI credits that add up fast. We use OpenRouter for chat models and Google Gemini for embeddings, both with generous free tiers."

**Visual**: OpenRouter dashboard showing free models

> "OpenRouter gives you access to state-of-the-art open models like DeepSeek Chat, Mistral, and Llama - all free."

**Visual**: Google AI Studio showing 1,500 requests/day free

> "Google Gemini provides 1,500 embedding requests per day free, which is plenty for most use cases."

**Visual**: Architecture diagram

> "The setup automatically falls back between models if one hits a rate limit, ensuring reliability."

---

## Scene 3: Document Management (2 minutes)

**Visual**: Drag and drop file upload

**Script**:
> "The document processing pipeline handles PDFs, Word docs, text files, and Markdown. Just drag and drop."

**Visual**: Uploading multiple files, progress indicators

> "Documents are processed asynchronously using Inngest. The pipeline extracts text, intelligently chunks it, generates embeddings, and stores everything in PostgreSQL with pgvector."

**Visual**: Prisma Studio showing document chunks

> "You can see the individual chunks and their embeddings in the database. Each chunk maintains metadata like page numbers and document source."

**Visual**: Document viewer with highlights

> "The viewer shows extracted text with original formatting preserved."

---

## Scene 4: RAG Chat Experience (2 minutes)

**Visual**: Chat interface, typing a query

**Script**:
> "The chat experience is where RAG shines. Ask any question about your documents."

**Visual**: Query sent, loading state shows "Searching documents..."

> "Behind the scenes, the system embeds your query, searches the vector database for relevant chunks, and combines them with the conversation history."

**Visual**: Response streaming in with citations

> "The response includes citations that link directly to source documents. Click any citation to see the exact context."

**Visual**: Clicking citation, highlighting source text

> "This transparency builds trust - you can verify every claim against your documents."

**Visual**: Showing conversation branching

> "We also support conversation branching. Want to explore a different angle? Fork the conversation at any point."

---

## Scene 5: Multi-tenancy & Workspaces (1.5 minutes)

**Visual**: Workspace switcher, multiple workspaces

**Script**:
> "Workspaces provide complete data isolation for teams. Each workspace has its own documents, chats, and members."

**Visual**: Creating a new workspace, inviting members

> "Create unlimited workspaces, invite team members, and assign roles - Owner, Admin, Member, or Viewer."

**Visual**: Showing RBAC permissions

> "Role-based access control ensures users only see what they're allowed to see."

---

## Scene 6: Enterprise Security (1.5 minutes)

**Visual**: Security architecture diagram

**Script**:
> "Security is built-in, not bolted-on. We have multiple authentication options."

**Visual**: Login page with OAuth options

> "Social login with GitHub and Google, plus email and password."

**Visual**: SAML configuration page

> "Enterprise users can configure SAML SSO with Okta, Azure AD, or any SAML 2.0 provider."

**Visual**: API keys management

> "Generate API keys for programmatic access with fine-grained permissions."

**Visual**: Audit log page

> "Every action is logged for compliance - who did what, when, and from where."

---

## Scene 7: Real-time Collaboration (1 minute)

**Visual**: Two browser windows side by side

**Script**:
> "Real-time collaboration keeps teams in sync. See who's online."

**Visual**: Typing indicators, presence avatars

> "Typing indicators show when someone is composing a message."

**Visual**: Live cursor sync on shared document

> "Live cursors track where others are looking."

**Visual**: Notification of new message

> "Instant notifications for mentions and updates."

---

## Scene 8: Customization & Theming (1 minute)

**Visual**: Theme toggle, switching light/dark modes

**Script**:
> "The UI is fully customizable. Toggle between light and dark modes."

**Visual**: Changing primary color, fonts

> "Modify the color scheme, typography, and component styles through CSS variables."

**Visual**: Custom logo upload

> "White-label the application with your own branding."

---

## Scene 9: Voice Features (1 minute)

**Visual**: Microphone button, voice input

**Script**:
> "Voice features make the chat accessible hands-free."

**Visual**: Speaking query, transcription appears

> "Click the microphone and speak your question. Speech recognition converts it to text."

**Visual**: Response read aloud

> "Enable text-to-speech to hear responses."

**Visual**: Wake word detection demo

> "Or use wake word detection - just say 'Hey RAG' to start."

---

## Scene 10: Deployment Options (1 minute)

**Visual**: Deployment architecture diagrams

**Script**:
> "When you're ready to deploy, you have options."

**Visual**: One-click deploy buttons

> "One-click deploy to Vercel, Railway, or Render."

**Visual**: Docker Compose setup

> "Full Docker Compose for self-hosting with complete control."

**Visual**: Kubernetes manifests

> "Or scale with Kubernetes on any cloud provider."

---

## Scene 11: Conclusion (30 seconds)

**Visual**: Feature montage, GitHub stars

**Script**:
> "The RAG Starter Kit gives you production-ready document Q&A in minutes, not months. With free AI, enterprise security, and real-time collaboration, it's everything you need to build the next generation of AI applications."

**On-screen**: 
- GitHub: github.com/rejisterjack/rag-starter-kit
- Docs: Full documentation
- Live Demo: Try it now

> "Star us on GitHub, read the docs, and start building today!"

---

## Production Notes

### Recording Checklist
- [ ] Clean browser (no bookmarks, extensions visible)
- [ ] Sample documents prepared
- [ ] Multiple accounts for collaboration demo
- [ ] Consistent color scheme (prefer dark mode)

### B-Roll Shots Needed
- Logo animation
- Architecture diagrams
- Code snippets
- Mobile responsiveness
- Performance metrics

### Music
- Upbeat tech background
- Volume lower during explanations

### Captions
- All narration captioned
- Key terms highlighted
- Code shown as text overlay
