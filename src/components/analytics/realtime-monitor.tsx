'use client';

import { Activity, MessageSquare, Users, Zap } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface RealtimeMetrics {
  activeUsers: number;
  activeChats: number;
  queriesPerMinute: number;
  tokensPerMinute: number;
}

export function RealtimeMonitor() {
  const [metrics, setMetrics] = useState<RealtimeMetrics>({
    activeUsers: 0,
    activeChats: 0,
    queriesPerMinute: 0,
    tokensPerMinute: 0,
  });
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  useEffect(() => {
    // Simulate real-time data updates
    const updateMetrics = () => {
      setMetrics({
        activeUsers: Math.floor(Math.random() * 50) + 10,
        activeChats: Math.floor(Math.random() * 20) + 5,
        queriesPerMinute: Math.floor(Math.random() * 100) + 20,
        tokensPerMinute: Math.floor(Math.random() * 5000) + 1000,
      });
      setLastUpdate(new Date());
    };

    updateMetrics();
    const interval = setInterval(updateMetrics, 5000);

    return () => clearInterval(interval);
  }, []);

  const items = [
    {
      label: 'Active Users',
      value: metrics.activeUsers,
      icon: Users,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
    },
    {
      label: 'Active Chats',
      value: metrics.activeChats,
      icon: MessageSquare,
      color: 'text-green-500',
      bgColor: 'bg-green-500/10',
    },
    {
      label: 'Queries/min',
      value: metrics.queriesPerMinute,
      icon: Activity,
      color: 'text-purple-500',
      bgColor: 'bg-purple-500/10',
    },
    {
      label: 'Tokens/min',
      value: metrics.tokensPerMinute.toLocaleString(),
      icon: Zap,
      color: 'text-amber-500',
      bgColor: 'bg-amber-500/10',
    },
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Real-time Activity</CardTitle>
            <CardDescription>Live metrics updates</CardDescription>
          </div>
          <div className="flex items-center space-x-2">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
            </span>
            <span className="text-xs text-muted-foreground">Live</span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          {items.map((item) => (
            <div key={item.label} className="flex items-center space-x-3 p-3 rounded-lg border">
              <div className={cn('p-2 rounded-md', item.bgColor)}>
                <item.icon className={cn('h-4 w-4', item.color)} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{item.label}</p>
                <p className="text-lg font-semibold">{item.value}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-4 text-center">
          Last updated: {lastUpdate.toLocaleTimeString()}
        </p>
      </CardContent>
    </Card>
  );
}
