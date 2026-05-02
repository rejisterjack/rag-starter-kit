'use client';

import { Check, CreditCard, Loader2, Zap } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';

interface Plan {
  id: string;
  name: string;
  displayName: string;
  description: string | null;
  priceMonth: number;
  priceYear: number;
  maxWorkspaces: number;
  maxDocuments: number;
  maxStorageGB: number;
  maxMessages: number;
  maxApiCalls: number;
  features: Record<string, unknown>;
}

interface Subscription {
  id: string;
  status: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
}

interface Usage {
  workspacesUsed: number;
  documentsUsed: number;
  storageUsed: number;
  messagesUsed: number;
  apiCallsUsed: number;
}

export default function BillingPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [currentPlan, setCurrentPlan] = useState<Plan | null>(null);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isYearly, setIsYearly] = useState(false);
  const [isSubscribing, setIsSubscribing] = useState<string | null>(null);

  const fetchBillingData = useCallback(async () => {
    try {
      const [plansRes, subRes] = await Promise.all([
        fetch('/api/billing/plans'),
        fetch('/api/billing/subscribe'),
      ]);

      if (plansRes.ok) {
        const plansData = await plansRes.json();
        if (plansData.success) {
          setPlans(plansData.data.plans);
        }
      }

      if (subRes.ok) {
        const subData = await subRes.json();
        if (subData.success) {
          setSubscription(subData.data.subscription);
          setCurrentPlan(subData.data.plan);
          setUsage(subData.data.usage);
        }
      }
    } catch (_error: unknown) {
      toast.error('Failed to load billing information');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBillingData();
  }, [fetchBillingData]);

  const handleSubscribe = async (planId: string) => {
    setIsSubscribing(planId);
    try {
      const response = await fetch('/api/billing/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId,
          billingCycle: isYearly ? 'year' : 'month',
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Failed to subscribe');
      }

      const data = await response.json();

      // If there's a client secret, we need to handle payment
      if (data.data.subscription?.clientSecret) {
        // Redirect to Stripe Checkout or handle payment element
        toast.info('Please complete payment in the checkout');
      } else {
        toast.success('Subscribed successfully!');
        fetchBillingData();
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to subscribe');
    } finally {
      setIsSubscribing(null);
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </div>
    );
  }

  const getUsagePercentage = (used: number, max: number) => {
    if (max === 0) return 0;
    return Math.min((used / max) * 100, 100);
  };

  return (
    <div className="container mx-auto p-6 space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Billing</h1>
        <p className="text-muted-foreground">Manage your subscription and usage</p>
      </div>

      {/* Current Subscription */}
      {subscription && currentPlan && (
        <Card>
          <CardHeader>
            <CardTitle>Current Plan</CardTitle>
            <CardDescription>
              You are currently on the {currentPlan.displayName} plan
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{currentPlan.displayName}</p>
                <p className="text-sm text-muted-foreground">
                  Renews on {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
                </p>
              </div>
              <div className="text-right">
                <p className="font-medium">
                  ${currentPlan.priceMonth > 0 ? currentPlan.priceMonth : 'Free'}
                  {currentPlan.priceMonth > 0 && (
                    <span className="text-muted-foreground">/month</span>
                  )}
                </p>
                <p className="text-sm text-muted-foreground capitalize">
                  {subscription.status.toLowerCase()}
                </p>
              </div>
            </div>

            {usage && (
              <>
                <Separator />
                <div className="space-y-4">
                  <h4 className="font-medium">Usage This Period</h4>

                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Documents</span>
                      <span>
                        {usage.documentsUsed} / {currentPlan.maxDocuments}
                      </span>
                    </div>
                    <Progress
                      value={getUsagePercentage(usage.documentsUsed, currentPlan.maxDocuments)}
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Storage</span>
                      <span>
                        {(usage.storageUsed / (1024 * 1024 * 1024)).toFixed(2)} GB /{' '}
                        {currentPlan.maxStorageGB} GB
                      </span>
                    </div>
                    <Progress
                      value={getUsagePercentage(
                        usage.storageUsed,
                        currentPlan.maxStorageGB * 1024 * 1024 * 1024
                      )}
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Messages</span>
                      <span>
                        {usage.messagesUsed} / {currentPlan.maxMessages}
                      </span>
                    </div>
                    <Progress
                      value={getUsagePercentage(usage.messagesUsed, currentPlan.maxMessages)}
                    />
                  </div>
                </div>
              </>
            )}

            <Separator />

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <CreditCard className="h-4 w-4" />
                <span className="text-sm">Payment Method</span>
              </div>
              <Button variant="outline" size="sm">
                Manage
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pricing Plans */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">Choose a Plan</h2>
          <div className="flex items-center space-x-2">
            <span className={!isYearly ? 'font-medium' : 'text-muted-foreground'}>Monthly</span>
            <Switch checked={isYearly} onCheckedChange={setIsYearly} />
            <span className={isYearly ? 'font-medium' : 'text-muted-foreground'}>Yearly</span>
            {isYearly && <span className="text-sm text-green-500">Save 20%</span>}
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {plans.map((plan) => {
            const isCurrentPlan = currentPlan?.id === plan.id;
            const price = isYearly ? plan.priceYear / 12 : plan.priceMonth;

            return (
              <Card key={plan.id} className={`relative ${isCurrentPlan ? 'border-primary' : ''}`}>
                {isCurrentPlan && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="bg-primary text-primary-foreground text-xs px-3 py-1 rounded-full">
                      Current Plan
                    </span>
                  </div>
                )}
                <CardHeader>
                  <CardTitle>{plan.displayName}</CardTitle>
                  <CardDescription>{plan.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <span className="text-4xl font-bold">${price > 0 ? price : 'Free'}</span>
                    {price > 0 && <span className="text-muted-foreground">/month</span>}
                    {isYearly && price > 0 && (
                      <p className="text-sm text-muted-foreground">
                        ${plan.priceYear}/year billed annually
                      </p>
                    )}
                  </div>

                  <ul className="space-y-2">
                    <li className="flex items-center text-sm">
                      <Check className="h-4 w-4 mr-2 text-green-500" />
                      {plan.maxWorkspaces} workspace{plan.maxWorkspaces !== 1 ? 's' : ''}
                    </li>
                    <li className="flex items-center text-sm">
                      <Check className="h-4 w-4 mr-2 text-green-500" />
                      {plan.maxDocuments} documents
                    </li>
                    <li className="flex items-center text-sm">
                      <Check className="h-4 w-4 mr-2 text-green-500" />
                      {plan.maxStorageGB} GB storage
                    </li>
                    <li className="flex items-center text-sm">
                      <Check className="h-4 w-4 mr-2 text-green-500" />
                      {plan.maxMessages.toLocaleString()} messages/month
                    </li>
                    <li className="flex items-center text-sm">
                      <Check className="h-4 w-4 mr-2 text-green-500" />
                      {plan.maxApiCalls.toLocaleString()} API calls/month
                    </li>
                  </ul>

                  <Button
                    className="w-full"
                    variant={isCurrentPlan ? 'outline' : 'default'}
                    disabled={isCurrentPlan || isSubscribing === plan.id}
                    onClick={() => handleSubscribe(plan.id)}
                  >
                    {isSubscribing === plan.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : isCurrentPlan ? (
                      'Current Plan'
                    ) : (
                      <>
                        <Zap className="h-4 w-4 mr-2" />
                        Subscribe
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
