import Link from 'next/link';

import { Button } from '@/components/ui/button';

export default function HomePage(): React.ReactElement {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-background to-muted/20 px-4">
      <div className="mx-auto max-w-3xl text-center">
        <h1 className="mb-6 text-4xl font-bold tracking-tight sm:text-6xl">
          RAG Chatbot
          <span className="block text-primary">Starter Kit</span>
        </h1>
        <p className="mb-8 text-lg text-muted-foreground sm:text-xl">
          A production-ready, self-hosted RAG (Retrieval-Augmented Generation) chatbot powered by
          Next.js 15, LangChain, and PostgreSQL pgvector.
        </p>
        <div className="flex flex-col gap-4 sm:flex-row sm:justify-center">
          <Button asChild size="lg" className="min-w-[200px]">
            <Link href="/chat">Start Chatting</Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="min-w-[200px]">
            <Link href="https://github.com/ragstarterkit/rag-starter-kit">View on GitHub</Link>
          </Button>
        </div>

        <div className="mt-16 grid gap-8 sm:grid-cols-3">
          <FeatureCard
            title="Intelligent RAG"
            description="Context-aware responses using LangChain and pgvector for accurate information retrieval."
          />
          <FeatureCard
            title="Document Ingestion"
            description="Upload and process PDFs, Word documents, and text files with automatic chunking."
          />
          <FeatureCard
            title="Real-time Streaming"
            description="Lightning-fast token streaming for natural conversation flow."
          />
        </div>
      </div>
    </div>
  );
}

interface FeatureCardProps {
  title: string;
  description: string;
}

function FeatureCard({ title, description }: FeatureCardProps): React.ReactElement {
  return (
    <div className="rounded-lg border bg-card p-6 text-card-foreground shadow-sm transition-colors hover:bg-accent/50">
      <h3 className="mb-2 font-semibold">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
