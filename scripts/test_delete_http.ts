import { prisma } from '../src/lib/db';

async function main() {
  console.log('--- FETCHING ACTIVE SESSIONS ---');
  const session = await prisma.session.findFirst({
    orderBy: { expires: 'desc' },
    include: { user: true }
  });
  
  if (!session) {
    console.log('No active sessions found in database.');
    return;
  }
  
  console.log(`Using session for user: ${session.user.name} (${session.user.email})`);
  console.log(`Session Token: ${session.sessionToken}`);
  console.log(`Expires: ${session.expires}`);

  // Find a chat for this user
  const chat = await prisma.chat.findFirst({
    where: { userId: session.userId }
  });
  
  if (!chat) {
    console.log('No chats found for this user to delete.');
    return;
  }
  
  console.log(`Found chat to delete: ${chat.id} ("${chat.title}")`);
  
  const url = `http://localhost:7392/api/chat?chatId=${chat.id}`;
  console.log(`Sending DELETE request to: ${url}`);
  
  try {
    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        // Set the NextAuth session token cookie
        'Cookie': `next-auth.session-token=${session.sessionToken}; __Secure-next-auth.session-token=${session.sessionToken}`,
        // Add CSRF ignore headers if required or origin header
        'Origin': 'http://localhost:7392',
        'Referer': 'http://localhost:7392/chat',
      }
    });
    
    console.log(`Response Status: ${response.status} ${response.statusText}`);
    console.log('Response Headers:', Object.fromEntries(response.headers.entries()));
    const body = await response.text();
    console.log('Response Body:', body);
  } catch (err) {
    console.error('Error during HTTP request:', err);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
