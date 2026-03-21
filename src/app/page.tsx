"use client";

import { useEffect, useRef } from "react";
import Link from 'next/link';
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { motion, useScroll, useTransform } from "framer-motion";
import { Button } from '@/components/ui/button';
import { ArrowRight, Bot, Database, Zap, FileText, Layers, ShieldCheck } from "lucide-react";

// Register GSAP Plugin
if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

const features = [
  {
    title: "Intelligent RAG",
    description: "Context-aware responses using LangChain and pgvector for unprecedented accuracy and recall.",
    icon: <Bot className="w-8 h-8 text-primary" />
  },
  {
    title: "Seamless Ingestion",
    description: "Upload and instantly process PDFs, Word documents, and pure text files with intelligent auto-chunking.",
    icon: <FileText className="w-8 h-8 text-primary" />
  },
  {
    title: "Ultra-low Latency",
    description: "Lightning-fast token streaming engineered for a natural, completely uninterrupted conversation flow.",
    icon: <Zap className="w-8 h-8 text-primary" />
  },
  {
    title: "Persistent Memory",
    description: "State-of-the-art semantic memory powered by PostgreSQL combined with the mighty pgvector extension.",
    icon: <Database className="w-8 h-8 text-primary" />
  },
  {
    title: "Modern Foundation",
    description: "Built strictly on the Next.js 15 App Router offering full React 19 Server Components support.",
    icon: <Layers className="w-8 h-8 text-primary" />
  },
  {
    title: "Enterprise Grade",
    description: "Ship with confidence using robust NextAuth integration and battle-tested architectural patterns.",
    icon: <ShieldCheck className="w-8 h-8 text-primary" />
  }
];

export default function HomePage(): React.ReactElement {
  const containerRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end start"]
  });

  const y1 = useTransform(scrollYProgress, [0, 1], [0, 200]);
  const opacity1 = useTransform(scrollYProgress, [0, 0.5], [1, 0]);

  useEffect(() => {
    if (!gridRef.current) return;
    
    const cards = gridRef.current.querySelectorAll('.feature-card');
    
    gsap.fromTo(cards, 
      { 
        y: 100, 
        opacity: 0,
        scale: 0.9,
        rotationX: 15
      },
      {
        y: 0,
        opacity: 1,
        scale: 1,
        rotationX: 0,
        duration: 1.2,
        stagger: 0.1,
        ease: "power4.out",
        scrollTrigger: {
          trigger: gridRef.current,
          start: "top 80%",
          end: "bottom 20%",
          toggleActions: "play none none reverse",
        }
      }
    );

    return () => {
      ScrollTrigger.getAll().forEach(t => t.kill());
    };
  }, []);

  return (
    <div ref={containerRef} className="relative min-h-screen text-foreground selection:bg-primary/30">
      
      {/* Hero Content - Spatial Depth */}
      <motion.div 
        style={{ y: y1, opacity: opacity1 }}
        className="relative z-10 mx-auto flex min-h-[90vh] max-w-7xl flex-col items-center justify-center px-4 text-center sm:px-6 lg:px-8"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20, filter: "blur(10px)" }}
          animate={{ opacity: 1, scale: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 1.2, type: "spring", bounce: 0.4 }}
          className="glass-heavy max-w-4xl rounded-[3rem] p-12 sm:p-20 flex flex-col items-center relative overflow-hidden"
        >
          {/* Internal specular highlight */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-[1px] bg-gradient-to-r from-transparent via-white/50 to-transparent" />
          
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.8, ease: "easeOut" }}
            className="mb-8 flex flex-col items-center gap-4"
          >
            <div className="inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-6 py-2.5 text-sm font-medium text-primary shadow-[0_0_30px_-5px_rgba(124,58,237,0.4)] backdrop-blur-xl">
              <Zap className="mr-2 h-4 w-4 fill-primary animate-pulse" />
              <span className="tracking-wide">Spatial AI Boilerplate</span>
            </div>
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-red-500 bg-red-500/10 px-3 py-1 rounded-full border border-red-500/20">
              Vision OS Active
            </div>
          </motion.div>

          <h1 className="mb-8 text-6xl font-extrabold tracking-tighter sm:text-7xl lg:text-8xl">
            <span className="block text-foreground drop-shadow-xl">RAG Chatbot</span>
            <span className="text-gradient block pb-2 mt-2">Starter Kit</span>
          </h1>
          
          <p className="mx-auto mb-12 max-w-2xl text-xl text-muted-foreground leading-relaxed font-light">
            A meticulously crafted, highly performant foundation. Harness the raw power of LangChain and pgvector within a breathtaking visionOS-inspired interface.
          </p>
          
          <div className="flex flex-col items-center justify-center gap-6 sm:flex-row w-full max-w-md mx-auto">
            <motion.div className="w-full" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Button asChild size="lg" className="w-full h-16 rounded-2xl bg-primary px-8 text-lg font-semibold shadow-[0_0_40px_-10px_rgba(124,58,237,0.8)] hover:bg-primary/90 transition-all duration-300">
                <Link href="/chat">
                  Start Chatting <ArrowRight className="ml-3 h-5 w-5" />
                </Link>
              </Button>
            </motion.div>
            <motion.div className="w-full" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Button asChild variant="outline" size="lg" className="w-full h-16 rounded-2xl bg-white/5 border-white/20 backdrop-blur-md hover:bg-white/10 text-lg transition-all duration-300">
                <Link href="https://github.com/ragstarterkit/rag-starter-kit">
                  View Source
                </Link>
              </Button>
            </motion.div>
          </div>
        </motion.div>
      </motion.div>

      {/* Features Grid - GSAP ScrollTriggered Spatial Cards */}
      <div className="relative z-20 bg-background/40 backdrop-blur-3xl border-t border-white/10 py-32 mt-[-5vh]">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-20">
            <h2 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">Architected for the Future</h2>
            <p className="mt-4 text-xl text-muted-foreground">Uncompromising performance meets state-of-the-art design.</p>
          </div>
          
          <div ref={gridRef} className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3 perspective-1000">
            {features.map((feature, idx) => (
              <motion.div
                key={idx}
                whileHover={{ y: -10, scale: 1.02, rotateX: 5, rotateY: -5 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                className="feature-card glass-panel group relative overflow-hidden rounded-[2.5rem] p-10 transition-all duration-500 transform-gpu"
                style={{ transformStyle: 'preserve-3d' }}
              >
                {/* Dynamic specular lighting effect on hover */}
                <div className="absolute inset-0 bg-gradient-to-br from-white/20 via-transparent to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100 pointer-events-none" />
                
                <div className="relative z-10" style={{ transform: 'translateZ(30px)' }}>
                  <div className="mb-8 inline-flex rounded-3xl bg-foreground/5 p-5 shadow-inner ring-1 ring-white/20 backdrop-blur-xl">
                    {feature.icon}
                  </div>
                  <h3 className="mb-4 text-2xl font-bold tracking-tight text-foreground">{feature.title}</h3>
                  <p className="text-muted-foreground text-lg leading-relaxed">{feature.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
