import { prisma } from '../src/lib/db';

async function main() {
  console.log('--- TESTING PRISMA QUERY WITH NULL/UNDEFINED ---');
  const userId = "cmopm87yy00004j2phnuukona";
  const chatId = "cmq42fe740009yurzrniqds66"; // a valid chat ID from Rupam
  
  // Test with undefined workspaceId
  try {
    const wsIdUndefined = undefined;
    console.log('Testing with workspaceId = undefined...');
    const result1 = await prisma.chat.findFirst({
      where: {
        id: chatId,
        OR: [{ userId }, wsIdUndefined ? { workspaceId: wsIdUndefined } : {}],
      },
    });
    console.log('Success! Result 1:', result1?.id);
  } catch (err: any) {
    console.error('FAILED with workspaceId = undefined:', err.message || err);
  }

  // Test with null workspaceId
  try {
    const wsIdNull = null;
    console.log('Testing with workspaceId = null...');
    const result2 = await prisma.chat.findFirst({
      where: {
        id: chatId,
        OR: [{ userId }, wsIdNull ? { workspaceId: wsIdNull } : {}],
      },
    });
    console.log('Success! Result 2:', result2?.id);
  } catch (err: any) {
    console.error('FAILED with workspaceId = null:', err.message || err);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
