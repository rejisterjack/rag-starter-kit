'use client';

import { motion } from 'framer-motion';

interface Tech {
  name: string;
  category: string;
  color: string;
}

const techStack: Tech[] = [
  { name: 'Next.js 15', category: 'Framework', color: '#000000' },
  { name: 'React 19', category: 'UI', color: '#61DAFB' },
  { name: 'TypeScript', category: 'Language', color: '#3178C6' },
  { name: 'Tailwind CSS 4', category: 'Styling', color: '#38B2AC' },
  { name: 'PostgreSQL', category: 'Database', color: '#4169E1' },
  { name: 'pgvector', category: 'Vectors', color: '#E69138' },
  { name: 'Prisma', category: 'ORM', color: '#2D3748' },
  { name: 'LangChain.js', category: 'AI', color: '#1C3C3C' },
  { name: 'Vercel AI SDK', category: 'AI', color: '#000000' },
  { name: 'OpenRouter', category: 'LLM', color: '#FF6600' },
  { name: 'Google Gemini', category: 'Embeddings', color: '#4285F4' },
  { name: 'Inngest', category: 'Queues', color: '#E4462D' },
  { name: 'Cloudinary', category: 'Storage', color: '#3448C5' },
  { name: 'NextAuth.js', category: 'Auth', color: '#3B82F6' },
  { name: 'Upstash Redis', category: 'Cache', color: '#DC382D' },
  { name: 'Plausible', category: 'Analytics', color: '#5850EC' },
  { name: 'Socket.io', category: 'Real-time', color: '#010101' },
  { name: 'Vitest', category: 'Testing', color: '#6E9F18' },
  { name: 'Playwright', category: 'E2E', color: '#2EAD33' },
  { name: 'Framer Motion', category: 'Motion', color: '#0055FF' },
  { name: 'shadcn/ui', category: 'UI', color: '#000000' },
  { name: 'Biome', category: 'Lint', color: '#60A5FA' },
  { name: 'Vercel', category: 'Deploy', color: '#000000' },
];

const duplicatedTechStack = [...techStack, ...techStack];

function TechBadge({ tech }: { tech: Tech }): React.ReactElement {
  return (
    <div className="inline-flex items-center gap-2 rounded-full glass-light px-4 py-2 mr-3 hover:bg-primary/5 transition-colors cursor-default shrink-0">
      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: tech.color }} />
      <span className="text-sm font-medium text-foreground whitespace-nowrap">{tech.name}</span>
      <span className="text-[10px] text-muted-foreground uppercase tracking-wider whitespace-nowrap">
        {tech.category}
      </span>
    </div>
  );
}

export function TechStackMarquee(): React.ReactElement {
  return (
    <section className="py-20 overflow-hidden">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 mb-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center"
        >
          <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Built with <span className="text-gradient">Modern Tools</span>
          </h2>
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
            Every dependency is deliberate, current, and maintained. No legacy, no dead weight.
          </p>
        </motion.div>
      </div>

      {/* First marquee - left to right */}
      <div className="relative mb-4 group">
        <div className="absolute left-0 top-0 bottom-0 w-20 bg-gradient-to-r from-background to-transparent z-10" />
        <div className="absolute right-0 top-0 bottom-0 w-20 bg-gradient-to-l from-background to-transparent z-10" />
        <div className="flex animate-marquee group-hover:[animation-play-state:paused]">
          {duplicatedTechStack.map((tech, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: duplicated marquee items need unique keys
            <TechBadge key={`${tech.name}-${index}`} tech={tech} />
          ))}
        </div>
      </div>

      {/* Second marquee - right to left */}
      <div className="relative group">
        <div className="absolute left-0 top-0 bottom-0 w-20 bg-gradient-to-r from-background to-transparent z-10" />
        <div className="absolute right-0 top-0 bottom-0 w-20 bg-gradient-to-l from-background to-transparent z-10" />
        <div className="flex animate-marquee-reverse group-hover:[animation-play-state:paused]">
          {[...duplicatedTechStack].reverse().map((tech, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: duplicated marquee items need unique keys
            <TechBadge key={`${tech.name}-rev-${index}`} tech={tech} />
          ))}
        </div>
      </div>
    </section>
  );
}
