'use client';

import { ArrowDown, ArrowUp } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface TopListItem {
  label: string;
  value: string;
  trend?: number;
}

interface TopListProps {
  title: string;
  items: TopListItem[];
  description?: string;
  className?: string;
}

export function TopList({ title, items, description, className }: TopListProps) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {items.map((item, index) => (
            <div key={index} className="flex items-center justify-between space-x-4">
              <div className="flex items-center space-x-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10">
                  <span className="text-sm font-semibold text-primary">{index + 1}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" title={item.label}>
                    {item.label}
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-sm text-muted-foreground">{item.value}</span>
                {item.trend !== undefined && (
                  <div
                    className={cn(
                      'flex items-center text-xs',
                      item.trend >= 0 ? 'text-green-500' : 'text-red-500'
                    )}
                  >
                    {item.trend >= 0 ? (
                      <ArrowUp className="h-3 w-3 mr-0.5" />
                    ) : (
                      <ArrowDown className="h-3 w-3 mr-0.5" />
                    )}
                    {Math.abs(item.trend)}%
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
