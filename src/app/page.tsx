"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  Bot,
  Database,
  Zap,
  FileText,
  Shield,
  Workflow,
  Sparkles,
  MessageSquare,
  Upload,
  Search,
  Github,
  ChevronRight,
  CheckCircle2,
} from "lucide-react";

// Animation variants
const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5 },
};

const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const features = [
  {
    icon: Bot,
    title: "Intelligent RAG",
    description:
      "Context-aware responses using LangChain and pgvector for unprecedented accuracy and recall.",
  },
  {
    icon: Upload,
    title: "Seamless Ingestion",
    description:
      "Upload and instantly process PDFs, Word docs, and text files with intelligent auto-chunking.",
  },
  {
    icon: Zap,
    title: "Ultra-low Latency",
    description:
      "Lightning-fast token streaming engineered for natural, uninterrupted conversation flow.",
  },
  {
    icon: Database,
    title: "Persistent Memory",
    description:
      "State-of-the-art semantic memory powered by PostgreSQL with pgvector extension.",
  },
  {
    icon: Shield,
    title: "Enterprise Ready",
    description:
      "Built with NextAuth, role-based access, and audit logging for production deployments.",
  },
  {
    icon: Workflow,
    title: "Async Processing",
    description:
      "Background job processing with Inngest for handling large documents and batch operations.",
  },
];

const steps = [
  {
    number: "01",
    title: "Upload Documents",
    description:
      "Drag and drop your PDFs, Word documents, or text files. We handle the rest.",
  },
  {
    number: "02",
    title: "Automatic Processing",
    description:
      "Our system chunks, embeds, and indexes your content using state-of-the-art AI models.",
  },
  {
    number: "03",
    title: "Start Chatting",
    description:
      "Ask questions in natural language and get accurate, cited answers from your documents.",
  },
];

const techStack = [
  { name: "Next.js 15", category: "Framework" },
  { name: "React 19", category: "UI" },
  { name: "TypeScript", category: "Language" },
  { name: "Tailwind CSS", category: "Styling" },
  { name: "PostgreSQL", category: "Database" },
  { name: "pgvector", category: "Vector Search" },
  { name: "Prisma", category: "ORM" },
  { name: "LangChain", category: "AI Framework" },
  { name: "OpenAI", category: "AI Models" },
  { name: "Inngest", category: "Background Jobs" },
  { name: "MinIO", category: "Object Storage" },
  { name: "NextAuth", category: "Authentication" },
];

export default function HomePage(): React.ReactElement {
  return (
    <div className="relative min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden pt-16 pb-24 lg:pt-32 lg:pb-40">
        {/* Background Elements */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-primary/20 rounded-full blur-[120px] opacity-50" />
          <div className="absolute bottom-0 right-0 w-[800px] h-[400px] bg-purple-500/10 rounded-full blur-[100px] opacity-40" />
        </div>

        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div
            className="text-center"
            initial="initial"
            animate="animate"
            variants={staggerContainer}
          >
            {/* Badge */}
            <motion.div variants={fadeInUp} className="mb-8 flex justify-center">
              <Link
                href="https://github.com/ragstarterkit/rag-starter-kit"
                className="inline-flex items-center gap-2 rounded-full bg-primary/10 border border-primary/20 px-4 py-1.5 text-sm font-medium text-primary hover:bg-primary/20 transition-colors"
              >
                <Sparkles className="h-4 w-4" />
                <span>Open Source on GitHub</span>
                <ChevronRight className="h-3 w-3" />
              </Link>
            </motion.div>

            {/* Headline */}
            <motion.h1
              variants={fadeInUp}
              className="text-4xl font-bold tracking-tight text-foreground sm:text-6xl lg:text-7xl"
            >
              Build AI-Powered
              <br />
              <span className="text-gradient">Document Chatbots</span>
            </motion.h1>

            {/* Subheadline */}
            <motion.p
              variants={fadeInUp}
              className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground"
            >
              A production-ready RAG starter kit powered by Next.js, LangChain,
              and PostgreSQL. Deploy intelligent chatbots that understand your
              documents in minutes, not months.
            </motion.p>

            {/* CTA Buttons */}
            <motion.div
              variants={fadeInUp}
              className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4"
            >
              <Button
                asChild
                size="lg"
                className="h-12 px-8 text-base rounded-full bg-primary hover:bg-primary/90"
              >
                <Link href="/chat">
                  Start Chatting
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                size="lg"
                className="h-12 px-8 text-base rounded-full"
              >
                <Link href="https://github.com/ragstarterkit/rag-starter-kit">
                  <Github className="mr-2 h-4 w-4" />
                  View on GitHub
                </Link>
              </Button>
            </motion.div>

            {/* Stats */}
            <motion.div
              variants={fadeInUp}
              className="mt-16 grid grid-cols-3 gap-8 border-y border-border py-8 sm:gap-12"
            >
              {[
                { value: "10x", label: "Faster Setup" },
                { value: "99.9%", label: "Uptime SLA" },
                { value: "50+", label: "Components" },
              ].map((stat) => (
                <div key={stat.label} className="text-center">
                  <div className="text-2xl font-bold text-foreground sm:text-3xl">
                    {stat.value}
                  </div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    {stat.label}
                  </div>
                </div>
              ))}
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 bg-muted/30">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Everything You Need
            </h2>
            <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
              A complete toolkit for building production-ready RAG applications
              without the boilerplate.
            </p>
          </motion.div>

          <motion.div
            className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
            initial="initial"
            whileInView="animate"
            viewport={{ once: true }}
            variants={staggerContainer}
          >
            {features.map((feature) => (
              <motion.div
                key={feature.title}
                variants={fadeInUp}
                className="group relative rounded-2xl bg-card border border-border p-6 hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300"
              >
                <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                  <feature.icon className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  {feature.title}
                </h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {feature.description}
                </p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              How It Works
            </h2>
            <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
              Get up and running in three simple steps. No complex configuration
              required.
            </p>
          </motion.div>

          <div className="grid gap-8 lg:grid-cols-3">
            {steps.map((step, index) => (
              <motion.div
                key={step.number}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="relative"
              >
                <div className="flex items-center gap-4 mb-4">
                  <span className="text-4xl font-bold text-primary/30">
                    {step.number}
                  </span>
                  {index < steps.length - 1 && (
                    <div className="hidden lg:block flex-1 h-px bg-border" />
                  )}
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-2">
                  {step.title}
                </h3>
                <p className="text-muted-foreground">{step.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Tech Stack */}
      <section className="py-24 bg-muted/30">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Modern Tech Stack
            </h2>
            <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
              Built with the latest technologies for performance, scalability,
              and developer experience.
            </p>
          </motion.div>

          <motion.div
            className="flex flex-wrap justify-center gap-3"
            initial="initial"
            whileInView="animate"
            viewport={{ once: true }}
            variants={staggerContainer}
          >
            {techStack.map((tech) => (
              <motion.div
                key={tech.name}
                variants={fadeInUp}
                className="group inline-flex items-center gap-2 rounded-full bg-card border border-border px-4 py-2 hover:border-primary/50 hover:bg-primary/5 transition-all"
              >
                <span className="text-sm font-medium text-foreground">
                  {tech.name}
                </span>
                <span className="text-xs text-muted-foreground">
                  {tech.category}
                </span>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="relative rounded-3xl bg-primary p-8 sm:p-16 text-center overflow-hidden"
          >
            {/* Background decoration */}
            <div className="absolute inset-0 -z-0">
              <div className="absolute top-0 left-0 w-96 h-96 bg-white/10 rounded-full blur-[100px]" />
              <div className="absolute bottom-0 right-0 w-96 h-96 bg-purple-500/20 rounded-full blur-[100px]" />
            </div>

            <div className="relative z-10">
              <h2 className="text-3xl font-bold tracking-tight text-primary-foreground sm:text-4xl">
                Ready to Get Started?
              </h2>
              <p className="mt-4 text-lg text-primary-foreground/80 max-w-2xl mx-auto">
                Deploy your own AI-powered document chatbot in minutes. Clone the
                repo, set your environment variables, and start chatting.
              </p>
              <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
                <Button
                  asChild
                  size="lg"
                  variant="secondary"
                  className="h-12 px-8 text-base rounded-full"
                >
                  <Link href="/chat">
                    Try Demo
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="h-12 px-8 text-base rounded-full bg-transparent border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10"
                >
                  <Link href="https://github.com/ragstarterkit/rag-starter-kit">
                    <Github className="mr-2 h-4 w-4" />
                    Clone Repository
                  </Link>
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Simple Footer */}
      <footer className="border-t border-border py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-6 w-6 text-primary" />
              <span className="font-semibold text-foreground">RAG Starter Kit</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Built with ❤️ using Next.js, LangChain, and PostgreSQL
            </p>
            <div className="flex items-center gap-4">
              <Link
                href="https://github.com/ragstarterkit/rag-starter-kit"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <Github className="h-5 w-5" />
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
