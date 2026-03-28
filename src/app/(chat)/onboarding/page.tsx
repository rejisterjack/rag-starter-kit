import { redirect } from 'next/navigation';
import { OnboardingWizard } from '@/components/onboarding/wizard';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

export default async function OnboardingPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/login');
  }

  // Check if user has any workspaces
  const workspaces = await prisma.workspaceMember.findMany({
    where: { userId: session.user.id },
    take: 1,
  });

  // If user already has workspaces, skip onboarding
  if (workspaces.length > 0) {
    redirect('/chat');
  }

  return (
    <OnboardingWizard
      user={{
        id: session.user.id,
        email: session.user.email || '',
        name: session.user.name,
      }}
    />
  );
}
