import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Start seeding...');

  // Create a test user (for development only)
  const testUser = await prisma.user.upsert({
    where: { email: 'test@example.com' },
    update: {},
    create: {
      email: 'test@example.com',
      name: 'Test User',
    },
  });

  console.log(`Created test user: ${testUser.email}`);

  // Create a sample chat
  const chat = await prisma.chat.create({
    data: {
      title: 'Welcome Chat',
      userId: testUser.id,
      messages: {
        create: [
          {
            content: 'Hello! Welcome to the RAG Chatbot.',
            role: 'ASSISTANT',
          },
        ],
      },
    },
  });

  console.log(`Created sample chat: ${chat.id}`);

  console.log('Seeding finished.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
