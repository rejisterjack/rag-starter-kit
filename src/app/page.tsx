"use client";

import { useEffect, useRef } from "react";
import Link from 'next/link';
import gsap from "gsap";
import { motion } from "framer-motion";
import { Button } from '@/components/ui/button';
import { ArrowRight, Bot, Database, Zap, FileText, Layers, ShieldCheck } from "lucide-react";

const features = [
  {
    title: "Intelligent RAG",
    description: "Context-aware responses using LangChain and pgvector for unprecedented accuracy and recall.",
    icon: <Bot className="w-6 h-6 text-primary" />
  },
  {
    title: "Seamless Ingestion",
    description: "Upload and instantly process PDFs, Word documents, and pure text files with intelligent auto-chunking.",
    icon: <FileText className="w-6 h-6 text-primary" />
  },
  {
    title: "Ultra-low Latency",
    description: "Lightning-fast token streaming engineered for a natural, completely uninterrupted conversation flow.",
    icon: <Zap className="w-6 h-6 text-primary" />
  },
  {
    title: "Persistent Memory",
    description: "State-of-the-art semantic memory powered by PostgreSQL combined with the mighty pgvector extension.",
    icon: <Database className="w-6 h-6 text-primary" />
  },
  {
    title: "Modern Foundation",
    description: "Built strictly on the Next.js 15 App Router offering full React 19 Server Components support.",
    icon: <Layers className="w-6 h-6 text-primary" />
  },
  {
    title: "Enterprise Grade",
    description: "Ship with confidence using robust NextAuth integration and battle-tested architectural patterns.",
    icon: <ShieldCheck className="w-6 h-6 text-primary" />
  }
];

export default function HomePage(): React.ReactElement {
  const bgRef = useRef<HTMLDivElement>(null);
  
  // GSAP Background Orb Animation
  useEffect(() => {
    if (!bgRef.current) return;
    const orbs = bgRef.current.querySelectorAll('.orb');
    
    orbs.forEach((orb, i) => {
      gsap.to(orb, {
        x: "random(-150, 150, 10)",
        y: "random(-150, 150, 10)",
        rotation: "random(-30, 30)",
        duration: "random(12, 24)",
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut",
        delay: i * -3,
      });
    });
  }, []);

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground selection:bg-primary/30">
      {/* Animated Background Orbs */}
      <div ref={bgRef} className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="orb absolute top-[-10%] left-[-10%] h-[50vw] w-[50vw] rounded-full bg-primary/20 blur-[120px] mix-blend-screen" />
        <div className="orb absolute bottom-[-10%] right-[-10%] h-[60vw] w-[60vw] rounded-full bg-blue-600/15 blur-[150px] mix-blend-screen" />
        <div className="orb absolute top-[40%] left-[50%] h-[40vw] w-[40vw] rounded-full bg-purple-600/15 blur-[100px] mix-blend-screen" />
      </div>

      {/* Hero Content */}
      <div className="relative z-10 mx-auto flex min-h-screen max-w-7xl flex-col items-center justify-center px-4 pt-32 text-center sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
          className="max-w-4xl"
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.6, ease: "easeOut" }}
            className="mx-auto mb-8 inline-flex items-center rounded-full border border-primary/30 bg-primary/5 px-5 py-2 text-sm font-medium text-primary shadow-[0_0_20px_-5px_rgba(124,58,237,0.3)] backdrop-blur-md"
          >
            <Zap className="mr-2 h-4 w-4 fill-primary" />
            <span className="tracking-wide">Next-Gen AI Boilerplate</span>
          </motion.div>

          <h1 className="mb-6 text-6xl font-extrabold tracking-tighter sm:text-7xl lg:text-9xl">
            <span className="block text-foreground drop-shadow-sm">RAG Chatbot</span>
            <span className="text-gradient block pb-4">Starter Kit</span>
          </h1>
          
          <p className="mx-auto mb-10 max-w-2xl text-lg text-muted-foreground/90 sm:text-xl leading-relaxed">
            A meticulously crafted, highly performant foundation. Harness the raw power of LangChain, pgvector, and the Vercel AI SDK within a breathtaking glassmorphic interface.
          </p>
          
          <div className="flex flex-col items-center justify-center gap-5 sm:flex-row pb-20">
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button asChild size="lg" className="h-14 min-w-[220px] rounded-full bg-primary px-8 text-base font-semibold shadow-[0_0_40px_-10px_rgba(124,58,237,0.6)] hover:bg-primary/90 transition-all duration-300">
                <Link href="/chat">
                  Start Chatting <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
            </motion.div>
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button asChild variant="outline" size="lg" className="glass h-14 min-w-[220px] rounded-full px-8 text-base font-medium hover:bg-white/5 dark:hover:bg-white/10 transition-all duration-300 border-border/50">
                <Link href="https://github.com/ragstarterkit/rag-starter-kit">
                  View Source
                </Link>
              </Button>
            </motion.div>
          </div>
        </motion.div>

        {/* Features Grid */}
        <motion.div 
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={{
            hidden: {},
            visible: {
              transition: { staggerChildren: 0.15 }
            }
          }}
          className="mx-auto mt-16 grid max-w-6xl gap-8 pb-32 sm:grid-cols-2 lg:grid-cols-3"
        >
          {features.map((feature, idx) => (
            <motion.div
              key={idx}
              variants={{
                hidden: { opacity: 0, y: 50, scale: 0.95 },
                visible: { opacity: 1, y: 0, scale: 1, transition: { type: "spring", stiffness: 40, damping: 15 } }
              }}
              whileHover={{ y: -10, scale: 1.03, transition: { duration: 0.2 } }}
              className="glass-panel group relative overflow-hidden rounded-[2rem] p-8 transition-all duration-300 border border-white/10 dark:border-white/5"
            >
              {/* Subtle hover gradient injection */}
              <div className="absolute inset-0 bg-gradient-to-br from-primary/15 via-transparent to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
              
              <div className="relative z-10">
                <div className="mb-6 inline-flex rounded-2xl bg-foreground/5 p-4 shadow-inner ring-1 ring-white/10 backdrop-blur-md">
                  {feature.icon}
                </div>
                <h3 className="mb-3 text-2xl font-bold tracking-tight text-foreground">{feature.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{feature.description}</p>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </div>
  );
}
