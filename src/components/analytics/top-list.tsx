"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Users,
  FileText,
  MessageSquare,
  Search,
  type LucideIcon,
} from "lucide-react";

export type TopListItemType = "user" | "document" | "query" | "generic";

export interface TopListItem {
  id: string;
  rank?: number;
  title: string;
  subtitle?: string;
  value: number | string;
  valueLabel?: string;
  trend?: number;
  avatarUrl?: string;
  icon?: LucideIcon;
  badge?: string;
  badgeVariant?: "default" | "secondary" | "destructive" | "outline" | "success" | "warning" | "info";
  progress?: number;
  progressMax?: number;
  href?: string;
}

export interface TopListProps {
  title: string;
  description?: string;
  items: TopListItem[];
  type?: TopListItemType;
  maxItems?: number;
  showRank?: boolean;
  showTrend?: boolean;
  showProgress?: boolean;
  loading?: boolean;
  emptyMessage?: string;
  className?: string;
  onItemClick?: (item: TopListItem) => void;
}

const typeIcons: Record<TopListItemType, LucideIcon> = {
  user: Users,
  document: FileText,
  query: Search,
  generic: MessageSquare,
};

function TrendIcon({ trend }: { trend: number }) {
  if (trend > 0) {
    return (
      <TrendingUp className="h-3 w-3 text-green-600 dark:text-green-400" />
    );
  }
  if (trend < 0) {
    return (
      <TrendingDown className="h-3 w-3 text-red-600 dark:text-red-400" />
    );
  }
  return <Minus className="h-3 w-3 text-muted-foreground" />;
}

function RankBadge({ rank }: { rank: number }) {
  const colors = {
    1: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100",
    2: "bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200",
    3: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-100",
  };

  return (
    <div
      className={cn(
        "flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold",
        rank <= 3 ? colors[rank as keyof typeof colors] : "bg-muted text-muted-foreground"
      )}
    >
      {rank}
    </div>
  );
}

function TopListItemRow({
  item,
  type,
  showRank,
  showTrend,
  showProgress,
  onClick,
}: {
  item: TopListItem;
  type: TopListItemType;
  showRank: boolean;
  showTrend: boolean;
  showProgress: boolean;
  onClick?: () => void;
}) {
  const IconComponent = item.icon || typeIcons[type];
  const progressValue = item.progress
    ? Math.min(100, (item.progress / (item.progressMax || item.progress)) * 100)
    : 0;

  return (
    <div
      className={cn(
        "flex items-center gap-3 p-3 rounded-lg transition-colors",
        onClick && "cursor-pointer hover:bg-muted/50",
        "border-b last:border-b-0"
      )}
      onClick={onClick}
    >
      {showRank && item.rank && <RankBadge rank={item.rank} />}

      <Avatar className="h-9 w-9 shrink-0">
        {item.avatarUrl ? (
          <AvatarImage src={item.avatarUrl} alt={item.title} />
        ) : (
          <AvatarFallback className="bg-muted">
            <IconComponent className="h-4 w-4 text-muted-foreground" />
          </AvatarFallback>
        )}
      </Avatar>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium truncate">{item.title}</span>
          {item.badge && (
            <Badge variant={item.badgeVariant || "secondary"} className="shrink-0 text-xs">
              {item.badge}
            </Badge>
          )}
        </div>
        {item.subtitle && (
          <p className="text-xs text-muted-foreground truncate">{item.subtitle}</p>
        )}
        {showProgress && item.progress !== undefined && (
          <div className="mt-2">
            <Progress value={progressValue} className="h-1.5" />
          </div>
        )}
      </div>

      <div className="text-right shrink-0">
        <div className="font-semibold">{item.value}</div>
        {item.valueLabel && (
          <p className="text-xs text-muted-foreground">{item.valueLabel}</p>
        )}
      </div>

      {showTrend && item.trend !== undefined && (
        <div className="flex items-center gap-1 shrink-0">
          <TrendIcon trend={item.trend} />
          <span
            className={cn(
              "text-xs font-medium",
              item.trend > 0 && "text-green-600 dark:text-green-400",
              item.trend < 0 && "text-red-600 dark:text-red-400",
              item.trend === 0 && "text-muted-foreground"
            )}
          >
            {Math.abs(item.trend).toFixed(1)}%
          </span>
        </div>
      )}
    </div>
  );
}

export function TopList({
  title,
  description,
  items,
  type = "generic",
  maxItems = 10,
  showRank = true,
  showTrend = false,
  showProgress = false,
  loading = false,
  emptyMessage = "No items to display",
  className,
  onItemClick,
}: TopListProps) {
  const displayItems = items.slice(0, maxItems);

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <Skeleton className="h-5 w-32" />
          {description && <Skeleton className="h-4 w-48 mt-2" />}
        </CardHeader>
        <CardContent className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-3">
              <Skeleton className="h-6 w-6 rounded-full" />
              <Skeleton className="h-9 w-9 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="h-4 w-12" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="p-0">
        {displayItems.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">{emptyMessage}</div>
        ) : (
          <div className="divide-y">
            {displayItems.map((item) => (
              <TopListItemRow
                key={item.id}
                item={item}
                type={type}
                showRank={showRank}
                showTrend={showTrend}
                showProgress={showProgress}
                onClick={onItemClick ? () => onItemClick(item) : undefined}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default TopList;
