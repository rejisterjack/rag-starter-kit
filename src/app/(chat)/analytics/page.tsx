"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
// UI Components
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

// Icons
import {
  BarChart3,
  Activity,
  Users,
  FileText,
  MessageSquare,
  Clock,
  DollarSign,
  Zap,
  Star,
  RefreshCw,
  Download,
} from "lucide-react";

// Analytics Components
import { MetricsCard, MetricsCardGroup } from "@/components/analytics/metrics-card";
import { TimeSeriesChart } from "@/components/analytics/time-series-chart";
import { DistributionChart } from "@/components/analytics/distribution-chart";
import { TopList } from "@/components/analytics/top-list";
import { RealtimeMonitor, useRealtimeData } from "@/components/analytics/realtime-monitor";
import { DateRangePicker, useDateRange, type DateRange } from "@/components/analytics/date-range-picker";

// Hooks
import {
  generateMockMetrics,
  generateMockTimeSeries,
  generateMockDistribution,
  type TopUser,
  type TopDocument,
  type TopQuery,
  type RealtimeEvent,
} from "@/hooks/use-analytics";

// Mock data for development
const MOCK_TOP_USERS: TopUser[] = [
  { id: "1", name: "Alice Johnson", email: "alice@example.com", queryCount: 342, totalTokens: 125000 },
  { id: "2", name: "Bob Smith", email: "bob@example.com", queryCount: 289, totalTokens: 98000 },
  { id: "3", name: "Carol White", email: "carol@example.com", queryCount: 256, totalTokens: 87000 },
  { id: "4", name: "David Brown", email: "david@example.com", queryCount: 198, totalTokens: 65000 },
  { id: "5", name: "Emma Davis", email: "emma@example.com", queryCount: 176, totalTokens: 54000 },
];

const MOCK_TOP_DOCUMENTS: TopDocument[] = [
  { id: "1", name: "Product Requirements.pdf", type: "application/pdf", queryCount: 156, chunkCount: 42 },
  { id: "2", name: "API Documentation.md", type: "text/markdown", queryCount: 134, chunkCount: 28 },
  { id: "3", name: "User Guide.docx", type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", queryCount: 98, chunkCount: 35 },
  { id: "4", name: "Architecture Overview.pdf", type: "application/pdf", queryCount: 87, chunkCount: 24 },
  { id: "5", name: "Meeting Notes.txt", type: "text/plain", queryCount: 65, chunkCount: 12 },
];

const MOCK_TOP_QUERIES: TopQuery[] = [
  { id: "1", query: "How do I implement authentication?", count: 45, avgResponseTime: 1.2 },
  { id: "2", query: "What are the API rate limits?", count: 38, avgResponseTime: 0.8 },
  { id: "3", query: "Explain the database schema", count: 32, avgResponseTime: 1.5 },
  { id: "4", query: "How to deploy to production?", count: 28, avgResponseTime: 1.1 },
  { id: "5", query: "Best practices for error handling", count: 24, avgResponseTime: 1.3 },
];

// Generate mock realtime events
function generateMockEvents(count: number = 10): RealtimeEvent[] {
  const types: RealtimeEvent["type"][] = ["query", "response", "error", "user", "system"];
  const messages: Record<RealtimeEvent["type"], string[]> = {
    query: ["New query received", "Document search initiated", "RAG query processed"],
    response: ["Response generated", "Sources cited", "Answer delivered"],
    error: ["Rate limit exceeded", "Document not found", "Processing timeout"],
    user: ["User logged in", "New session started", "User preference updated"],
    system: ["Cache cleared", "Model warmed up", "Index updated"],
  };

  return Array.from({ length: count }, (_, i) => {
    const type = types[Math.floor(Math.random() * types.length)];
    return {
      id: `evt-${Date.now()}-${i}`,
      type,
      message: messages[type][Math.floor(Math.random() * messages[type].length)],
      timestamp: new Date(Date.now() - i * 60000),
      metadata: { userId: `user-${Math.floor(Math.random() * 100)}`, latency: `${(Math.random() * 2).toFixed(2)}s` },
    };
  }).reverse();
}

// Format trend items for TopList
function formatTopUsers(users: TopUser[]) {
  return users.map((user, index) => ({
    id: user.id,
    rank: index + 1,
    title: user.name,
    subtitle: user.email,
    value: user.queryCount.toLocaleString(),
    valueLabel: "queries",
    avatarUrl: user.avatarUrl,
    trend: Math.random() > 0.5 ? Math.random() * 20 : -Math.random() * 10,
  }));
}

function formatTopDocuments(docs: TopDocument[]) {
  return docs.map((doc, index) => ({
    id: doc.id,
    rank: index + 1,
    title: doc.name,
    subtitle: `${doc.chunkCount} chunks`,
    value: doc.queryCount.toLocaleString(),
    valueLabel: "queries",
    trend: Math.random() > 0.5 ? Math.random() * 15 : -Math.random() * 8,
  }));
}

function formatTopQueries(queries: TopQuery[]) {
  return queries.map((q, index) => ({
    id: q.id,
    rank: index + 1,
    title: q.query,
    subtitle: `Avg: ${q.avgResponseTime.toFixed(2)}s`,
    value: q.count.toLocaleString(),
    valueLabel: "times",
    trend: Math.random() > 0.5 ? Math.random() * 25 : -Math.random() * 12,
  }));
}

// Sparkline data generator
function generateSparklineData(length: number = 7): number[] {
  return Array.from({ length }, () => Math.floor(Math.random() * 100) + 50);
}

export default function AnalyticsPage(): React.ReactElement {
  const [activeTab, setActiveTab] = React.useState("overview");
  const { range, preset, setRange } = useDateRange("last7days");
  const { tick } = useRealtimeData({ refreshInterval: 5000 });

  // In a real app, these would fetch from the API
  // For now, using mock data
  const metrics = React.useMemo(() => generateMockMetrics(), [range]);
  const timeSeriesData = React.useMemo(() => generateMockTimeSeries(30), [range]);
  const queryTypes = React.useMemo(() => generateMockDistribution(), []);

  const events = React.useMemo(() => generateMockEvents(20), [tick]);

  // Realtime metrics
  const realtimeMetrics: import("@/components/analytics/realtime-monitor").RealtimeMetric[] = [
    { id: "active-users", label: "Active Users", value: Math.floor(Math.random() * 50) + 10, icon: Users, color: "#3b82f6" },
    { id: "queries-min", label: "Queries/min", value: Math.floor(Math.random() * 20) + 5, icon: MessageSquare, color: "#10b981" },
    { id: "avg-latency", label: "Avg Latency", value: `${(Math.random() * 2 + 0.5).toFixed(2)}s`, icon: Clock, color: "#f59e0b" },
    { id: "error-rate", label: "Error Rate", value: `${(Math.random() * 2).toFixed(1)}%`, icon: Activity, color: "#ef4444" },
  ];

  const handleDateRangeChange = (newRange: DateRange, newPreset: string) => {
    setRange(newRange, newPreset as typeof preset);
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card px-6 py-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Analytics Dashboard</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Monitor your RAG system performance and usage metrics
            </p>
          </div>
          <div className="flex items-center gap-3">
            <DateRangePicker
              value={range}
              onChange={handleDateRangeChange}
              className="w-[280px]"
            />
            <Button variant="outline" size="icon">
              <Download className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Tabs Navigation */}
      <div className="border-b bg-card px-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full justify-start rounded-none bg-transparent p-0 h-12">
            <TabsTrigger
              value="overview"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4"
            >
              <BarChart3 className="h-4 w-4 mr-2" />
              Overview
            </TabsTrigger>
            <TabsTrigger
              value="usage"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4"
            >
              <Users className="h-4 w-4 mr-2" />
              Usage
            </TabsTrigger>
            <TabsTrigger
              value="quality"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4"
            >
              <Star className="h-4 w-4 mr-2" />
              Quality
            </TabsTrigger>
            <TabsTrigger
              value="costs"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4"
            >
              <DollarSign className="h-4 w-4 mr-2" />
              Costs
            </TabsTrigger>
            <TabsTrigger
              value="realtime"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4"
            >
              <Activity className="h-4 w-4 mr-2" />
              Real-time
            </TabsTrigger>
          </TabsList>

          {/* Tab Contents */}
          <div className="flex-1 overflow-auto p-6">
            {/* Overview Tab */}
            <TabsContent value="overview" className="mt-0 space-y-6">
              {/* Key Metrics */}
              <MetricsCardGroup columns={4}>
                <MetricsCard
                  title="Total Queries"
                  value={metrics.totalQueries}
                  trend={metrics.queriesTrend}
                  trendLabel="vs last period"
                  icon={<MessageSquare className="h-4 w-4" />}
                  sparklineData={generateSparklineData()}
                />
                <MetricsCard
                  title="Active Users"
                  value={metrics.totalUsers}
                  trend={metrics.usersTrend}
                  trendLabel="vs last period"
                  icon={<Users className="h-4 w-4" />}
                  sparklineData={generateSparklineData()}
                />
                <MetricsCard
                  title="Documents"
                  value={metrics.totalDocuments}
                  trend={metrics.documentsTrend}
                  trendLabel="vs last period"
                  icon={<FileText className="h-4 w-4" />}
                  sparklineData={generateSparklineData()}
                />
                <MetricsCard
                  title="Avg Response Time"
                  value={metrics.avgResponseTime}
                  suffix="s"
                  trend={metrics.responseTimeTrend}
                  trendLabel="vs last period"
                  icon={<Clock className="h-4 w-4" />}
                  sparklineData={generateSparklineData()}
                />
              </MetricsCardGroup>

              {/* Charts Row */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <TimeSeriesChart
                  className="lg:col-span-2"
                  title="Query Volume & Users"
                  description="Daily queries and active users over time"
                  data={timeSeriesData}
                  series={[
                    { key: "queries", name: "Queries", color: "hsl(var(--primary))" },
                    { key: "users", name: "Active Users", color: "hsl(var(--secondary))" },
                  ]}
                  type="area"
                  height={300}
                />
                <DistributionChart
                  title="Query Types"
                  description="Distribution of query categories"
                  data={queryTypes}
                  type="donut"
                  height={300}
                />
              </div>

              {/* Top Lists Row */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <TopList
                  title="Top Users"
                  description="Most active users by query count"
                  items={formatTopUsers(MOCK_TOP_USERS)}
                  type="user"
                  showTrend
                />
                <TopList
                  title="Top Documents"
                  description="Most referenced documents"
                  items={formatTopDocuments(MOCK_TOP_DOCUMENTS)}
                  type="document"
                  showTrend
                />
                <TopList
                  title="Popular Queries"
                  description="Most frequently asked questions"
                  items={formatTopQueries(MOCK_TOP_QUERIES)}
                  type="query"
                  showTrend
                />
              </div>
            </TabsContent>

            {/* Usage Tab */}
            <TabsContent value="usage" className="mt-0 space-y-6">
              <MetricsCardGroup columns={4}>
                <MetricsCard
                  title="Total Queries"
                  value={metrics.totalQueries}
                  trend={metrics.queriesTrend}
                  icon={<MessageSquare className="h-4 w-4" />}
                />
                <MetricsCard
                  title="Unique Users"
                  value={metrics.totalUsers}
                  trend={metrics.usersTrend}
                  icon={<Users className="h-4 w-4" />}
                />
                <MetricsCard
                  title="Avg Queries/User"
                  value={(metrics.totalQueries / metrics.totalUsers).toFixed(1)}
                  icon={<BarChart3 className="h-4 w-4" />}
                />
                <MetricsCard
                  title="Peak Concurrent"
                  value={45}
                  trend={12.5}
                  icon={<Zap className="h-4 w-4" />}
                />
              </MetricsCardGroup>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <TimeSeriesChart
                  title="User Activity"
                  description="Daily active users and new signups"
                  data={timeSeriesData}
                  series={[
                    { key: "users", name: "Active Users", color: "hsl(var(--primary))" },
                  ]}
                  type="bar"
                  height={300}
                />
                <TopList
                  title="Most Active Users"
                  description="Users with highest query volume"
                  items={formatTopUsers(MOCK_TOP_USERS)}
                  type="user"
                  showProgress
                  maxItems={10}
                />
              </div>

              <TimeSeriesChart
                title="Hourly Usage Pattern"
                description="Query volume by hour of day"
                data={timeSeriesData.slice(-24).map((d: Record<string, number | string>, i: number) => ({
                  ...d,
                  date: `${i}:00`,
                }))}
                series={[
                  { key: "queries", name: "Queries", color: "hsl(var(--primary))" },
                ]}
                type="bar"
                height={250}
              />
            </TabsContent>

            {/* Quality Tab */}
            <TabsContent value="quality" className="mt-0 space-y-6">
              <MetricsCardGroup columns={4}>
                <MetricsCard
                  title="Satisfaction Score"
                  value={metrics.satisfactionScore}
                  suffix="/5"
                  trend={metrics.satisfactionTrend}
                  icon={<Star className="h-4 w-4" />}
                  variant="success"
                />
                <MetricsCard
                  title="Avg Response Time"
                  value={metrics.avgResponseTime}
                  suffix="s"
                  trend={metrics.responseTimeTrend}
                  icon={<Clock className="h-4 w-4" />}
                />
                <MetricsCard
                  title="Error Rate"
                  value={1.2}
                  suffix="%"
                  trend={-0.5}
                  icon={<Activity className="h-4 w-4" />}
                  variant="warning"
                />
                <MetricsCard
                  title="Cache Hit Rate"
                  value={67}
                  suffix="%"
                  trend={5.3}
                  icon={<Zap className="h-4 w-4" />}
                  variant="success"
                />
              </MetricsCardGroup>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <TimeSeriesChart
                  title="Response Time Trend"
                  description="Average response time over time"
                  data={timeSeriesData}
                  series={[
                    { key: "responseTime", name: "Response Time (s)", color: "hsl(var(--primary))" },
                  ]}
                  type="line"
                  height={300}
                />
                <DistributionChart
                  title="Response Time Distribution"
                  description="Query response time buckets"
                  data={[
                    { name: "< 1s", value: 450, color: "#22c55e" },
                    { name: "1-2s", value: 320, color: "#3b82f6" },
                    { name: "2-3s", value: 150, color: "#f59e0b" },
                    { name: "> 3s", value: 80, color: "#ef4444" },
                  ]}
                  type="donut"
                  height={300}
                />
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Feedback Summary</CardTitle>
                  <CardDescription>User feedback and ratings breakdown</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-5 gap-4">
                    {[5, 4, 3, 2, 1].map((rating) => (
                      <div key={rating} className="text-center">
                        <div className="flex items-center justify-center gap-1 mb-2">
                          <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                          <span className="font-medium">{rating}</span>
                        </div>
                        <div className="h-24 bg-muted rounded-md relative overflow-hidden">
                          <div
                            className="absolute bottom-0 left-0 right-0 bg-primary transition-all"
                            style={{ height: `${[45, 30, 15, 7, 3][5 - rating]}%` }}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                          {[45, 30, 15, 7, 3][5 - rating]}%
                        </p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Costs Tab */}
            <TabsContent value="costs" className="mt-0 space-y-6">
              <MetricsCardGroup columns={4}>
                <MetricsCard
                  title="Total Cost"
                  value={metrics.totalCost}
                  prefix="$"
                  trend={metrics.costTrend}
                  icon={<DollarSign className="h-4 w-4" />}
                />
                <MetricsCard
                  title="Total Tokens"
                  value={metrics.totalTokens}
                  trend={metrics.tokensTrend}
                  icon={<FileText className="h-4 w-4" />}
                />
                <MetricsCard
                  title="Cost/Query"
                  value={(metrics.totalCost / metrics.totalQueries).toFixed(4)}
                  prefix="$"
                  icon={<BarChart3 className="h-4 w-4" />}
                />
                <MetricsCard
                  title="Cost/1K Tokens"
                  value={((metrics.totalCost / metrics.totalTokens) * 1000).toFixed(4)}
                  prefix="$"
                  icon={<Zap className="h-4 w-4" />}
                />
              </MetricsCardGroup>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <TimeSeriesChart
                  title="Daily Costs"
                  description="Cost breakdown by day"
                  data={timeSeriesData}
                  series={[
                    { key: "cost", name: "Cost ($)", color: "hsl(var(--primary))" },
                  ]}
                  type="area"
                  height={300}
                />
                <TimeSeriesChart
                  title="Token Usage"
                  description="Daily token consumption"
                  data={timeSeriesData}
                  series={[
                    { key: "tokens", name: "Tokens", color: "hsl(var(--secondary))" },
                  ]}
                  type="bar"
                  height={300}
                />
              </div>

              <DistributionChart
                title="Cost by Model"
                description="Cost distribution across AI models"
                data={[
                  { name: "GPT-4", value: 65, color: "#10b981" },
                  { name: "GPT-3.5", value: 25, color: "#3b82f6" },
                  { name: "Claude", value: 8, color: "#f59e0b" },
                  { name: "Other", value: 2, color: "#6b7280" },
                ]}
                type="pie"
                height={280}
              />
            </TabsContent>

            {/* Real-time Tab */}
            <TabsContent value="realtime" className="mt-0 space-y-6">
              <RealtimeMonitor
                title="Live System Monitor"
                description="Real-time metrics and system events"
                metrics={realtimeMetrics}
                events={events}
                isConnected={true}
                lastUpdated={new Date()}
                maxEvents={50}
              />

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Query Latency (Last Hour)</CardTitle>
                    <CardDescription>Real-time response times</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-48 flex items-end gap-1">
                      {Array.from({ length: 60 }, (_, i) => {
                        const height = Math.random() * 80 + 20;
                        const color = height > 80 ? "bg-red-500" : height > 50 ? "bg-yellow-500" : "bg-green-500";
                        return (
                          <div
                            key={i}
                            className={cn("flex-1 rounded-t", color)}
                            style={{ height: `${height}%` }}
                            title={`${height.toFixed(0)}0ms`}
                          />
                        );
                      })}
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground mt-2">
                      <span>-60 min</span>
                      <span>-30 min</span>
                      <span>Now</span>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>System Health</CardTitle>
                    <CardDescription>Component status overview</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {[
                      { name: "API Gateway", status: "healthy", latency: "12ms" },
                      { name: "Vector DB", status: "healthy", latency: "45ms" },
                      { name: "LLM Service", status: "healthy", latency: "1.2s" },
                      { name: "Document Store", status: "warning", latency: "120ms" },
                      { name: "Cache Layer", status: "healthy", latency: "2ms" },
                    ].map((component) => (
                      <div key={component.name} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                        <div className="flex items-center gap-3">
                          <div
                            className={cn(
                              "h-2 w-2 rounded-full",
                              component.status === "healthy" && "bg-green-500",
                              component.status === "warning" && "bg-yellow-500",
                              component.status === "error" && "bg-red-500"
                            )}
                          />
                          <span className="font-medium">{component.name}</span>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-sm text-muted-foreground">{component.latency}</span>
                          <Badge
                            variant={component.status === "healthy" ? "default" : "secondary"}
                            className={cn(
                              component.status === "healthy" && "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100",
                              component.status === "warning" && "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100"
                            )}
                          >
                            {component.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
}
