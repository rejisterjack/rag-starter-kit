'use client';

import { BarChart3, KeyRound, Settings2, Webhook } from 'lucide-react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const settingsPages = [
  {
    href: '/chat/settings/rag',
    icon: Settings2,
    title: 'RAG Settings',
    description: 'Chunking, retrieval, and generation parameters for this workspace',
  },
  {
    href: '/chat/settings/api-keys',
    icon: KeyRound,
    title: 'API Keys',
    description: 'Create and manage API keys for programmatic access',
  },
  {
    href: '/chat/settings/webhooks',
    icon: Webhook,
    title: 'Webhooks',
    description: 'Configure HTTP endpoints for real-time event delivery',
  },
  {
    href: '/chat/analytics',
    icon: BarChart3,
    title: 'Analytics',
    description: 'Usage metrics and performance charts',
  },
];

export default function SettingsIndexPage() {
  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Manage workspace configuration, integrations, and access
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {settingsPages.map((page) => (
          <Link key={page.href} href={page.href} className="group">
            <Card className="h-full transition-colors group-hover:border-primary/40">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <page.icon className="h-4 w-4 text-primary" />
                  {page.title}
                </CardTitle>
                <CardDescription>{page.description}</CardDescription>
              </CardHeader>
              <CardContent />
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
