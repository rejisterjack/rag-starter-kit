'use client';

import { motion } from 'framer-motion';
import { Eye, GitFork, Github, Star } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

interface GitHubStatsData {
  stars: number;
  forks: number;
  watchers: number;
  updatedAt: string;
}

export function GitHubStats(): React.ReactElement {
  const [stats, setStats] = useState<GitHubStatsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch('https://api.github.com/repos/rejisterjack/rag-starter-kit', {
          next: { revalidate: 3600 },
        });
        if (response.ok) {
          const data = await response.json();
          setStats({
            stars: data.stargazers_count,
            forks: data.forks_count,
            watchers: data.watchers_count,
            updatedAt: data.updated_at,
          });
        }
      } catch (_error: unknown) {
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  const formatNumber = (num: number): string => {
    if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}k`;
    }
    return num.toString();
  };

  const statsItems = [
    { icon: Star, label: 'Stars', value: stats?.stars ?? 0, placeholder: '...' },
    { icon: GitFork, label: 'Forks', value: stats?.forks ?? 0, placeholder: '...' },
    { icon: Eye, label: 'Watchers', value: stats?.watchers ?? 0, placeholder: '...' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
      className="flex flex-wrap items-center justify-center gap-4"
    >
      {statsItems.map((item) => (
        <Link
          key={item.label}
          href="https://github.com/rejisterjack/rag-starter-kit"
          target="_blank"
          rel="noopener noreferrer"
          className="glass-light rounded-full px-4 py-2 flex items-center gap-2 hover:bg-primary/5 transition-colors"
        >
          <item.icon className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium text-foreground">
            {loading ? item.placeholder : formatNumber(item.value)}
          </span>
          <span className="text-xs text-muted-foreground">{item.label}</span>
        </Link>
      ))}

      <Link
        href="https://github.com/rejisterjack/rag-starter-kit"
        target="_blank"
        rel="noopener noreferrer"
        className="glass-light rounded-full px-4 py-2 flex items-center gap-2 hover:bg-primary/5 transition-colors"
      >
        <Github className="h-4 w-4 text-foreground" />
        <span className="text-sm font-medium text-foreground">View Repository</span>
      </Link>
    </motion.div>
  );
}
