'use client';

import { BarChart3, Construction } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function AnalyticsPage(): React.ReactElement {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
          <p className="text-muted-foreground">
            Track your chat usage and document processing metrics.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Construction className="h-5 w-5 text-yellow-500" />
            <CardTitle>Coming Soon</CardTitle>
          </div>
          <CardDescription>
            Advanced analytics dashboard is under development.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center py-12 space-y-4">
          <BarChart3 className="h-16 w-16 text-muted-foreground/50" />
          <p className="text-muted-foreground text-center max-w-md">
            This page will display detailed metrics about your RAG usage,
            including chat history, document processing stats, token usage,
            and real-time activity monitoring.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
