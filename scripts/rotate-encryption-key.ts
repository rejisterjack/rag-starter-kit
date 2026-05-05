/**
 * ENCRYPTION_MASTER_KEY Rotation Script
 *
 * Re-encrypts all values that were encrypted with the old master key
 * so that they work with the new master key.
 *
 * Usage:
 *   # Dry run (no writes):
 *   pnpm tsx scripts/rotate-encryption-key.ts --dry-run
 *
 *   # Apply rotation:
 *   pnpm tsx scripts/rotate-encryption-key.ts
 *
 * Environment variables required:
 *   ENCRYPTION_MASTER_KEY      — the CURRENT (old) key
 *   ENCRYPTION_MASTER_KEY_NEW  — the NEW key to rotate to
 *   DATABASE_URL               — PostgreSQL connection string
 *
 * See docs/SECURITY.md → "ENCRYPTION_MASTER_KEY Rotation" for the full procedure.
 */

import crypto from 'node:crypto';
import process from 'node:process';

// ─── parse CLI flags ────────────────────────────────────────────────────────
const DRY_RUN = process.argv.includes('--dry-run');

// ─── load env (Node 20+ built-in, no dotenv dependency required) ─────────────
try {
  // process.loadEnvFile is available in Node 20.12+
  // biome-ignore lint/suspicious/noExplicitAny: Node 20 built-in not in older @types/node
  (process as any).loadEnvFile?.('.env');
} catch {
  // .env file not present — assume env vars are already set externally
}

const OLD_KEY = process.env.ENCRYPTION_MASTER_KEY;
const NEW_KEY = process.env.ENCRYPTION_MASTER_KEY_NEW;

if (!OLD_KEY || OLD_KEY.length < 32) {
  console.error('❌  ENCRYPTION_MASTER_KEY is missing or shorter than 32 characters.');
  process.exit(1);
}
if (!NEW_KEY || NEW_KEY.length < 32) {
  console.error('❌  ENCRYPTION_MASTER_KEY_NEW is missing or shorter than 32 characters.');
  console.error('   Generate one with:  openssl rand -base64 32');
  process.exit(1);
}
if (OLD_KEY === NEW_KEY) {
  console.error('❌  OLD and NEW keys are identical — nothing to rotate.');
  process.exit(1);
}

// ─── encryption helpers ──────────────────────────────────────────────────────
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const KEY_ENCODING = 'base64';

function deriveKey(masterKey: string): Buffer {
  return crypto.createHash('sha256').update(masterKey).digest();
}

/**
 * Decrypt a value that was encrypted with `masterKey`.
 * Format: base64( iv[12] | tag[16] | ciphertext )
 */
function decrypt(encryptedB64: string, masterKey: string): string {
  const buf = Buffer.from(encryptedB64, KEY_ENCODING);
  const iv = buf.subarray(0, IV_LENGTH);
  const tag = buf.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const ciphertext = buf.subarray(IV_LENGTH + TAG_LENGTH);
  const key = deriveKey(masterKey);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

/**
 * Encrypt a plaintext value with `masterKey`.
 * Returns base64( iv[12] | tag[16] | ciphertext ).
 */
function encrypt(plaintext: string, masterKey: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const key = deriveKey(masterKey);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ciphertext]).toString(KEY_ENCODING);
}

/**
 * Re-encrypt a single value from OLD_KEY → NEW_KEY.
 * Returns null if the value is null/undefined/empty.
 * Throws if decryption fails (wrong key or corrupted data).
 */
function reEncrypt(encryptedB64: string | null | undefined): string | null {
  if (!encryptedB64) return null;
  const plaintext = decrypt(encryptedB64, OLD_KEY!);
  return encrypt(plaintext, NEW_KEY!);
}

// ─── database client ─────────────────────────────────────────────────────────
// Dynamic import so the script can run independently of the Next.js build.
// Falls back to a direct pg connection if @prisma/client is unavailable.
async function getDb() {
  try {
    // Prisma v7 uses a default export
    const prismaModule = await import('@prisma/client');
    // biome-ignore lint/suspicious/noExplicitAny: Prisma export shape varies by version
    const PrismaClient = (prismaModule as any).PrismaClient ?? (prismaModule as any).default?.PrismaClient;
    if (!PrismaClient) throw new Error('PrismaClient not found in @prisma/client exports');
    return new PrismaClient();
  } catch (err) {
    throw new Error(
      `Could not import @prisma/client: ${err instanceof Error ? err.message : String(err)}.\nRun \`pnpm prisma generate\` first.`
    );
  }
}

// ─── rotation logic ───────────────────────────────────────────────────────────

interface RotationResult {
  table: string;
  column: string;
  total: number;
  rotated: number;
  skipped: number;
  errors: number;
}

async function rotateTable(
  // biome-ignore lint/suspicious/noExplicitAny: prisma client is dynamic
  db: any,
  modelName: string,
  encryptedColumns: string[]
): Promise<RotationResult[]> {
  const results: RotationResult[] = [];

  for (const column of encryptedColumns) {
    const result: RotationResult = {
      table: modelName,
      column,
      total: 0,
      rotated: 0,
      skipped: 0,
      errors: 0,
    };

    // biome-ignore lint/suspicious/noExplicitAny: dynamic prisma model
    const model = (db as any)[modelName];
    if (!model) {
      console.warn(`  ⚠  Model "${modelName}" not found in Prisma client — skipping.`);
      results.push(result);
      continue;
    }

    const records = await model.findMany({
      select: { id: true, [column]: true },
    });

    result.total = records.length;

    for (const record of records) {
      const encryptedValue = record[column];
      if (!encryptedValue) {
        result.skipped++;
        continue;
      }

      try {
        const reEncrypted = reEncrypt(encryptedValue);
        if (reEncrypted === null) {
          result.skipped++;
          continue;
        }

        if (!DRY_RUN) {
          await model.update({
            where: { id: record.id },
            data: { [column]: reEncrypted },
          });
        }
        result.rotated++;
      } catch (err) {
        console.error(
          `  ✗  ${modelName}.${column} id=${record.id}: ${err instanceof Error ? err.message : String(err)}`
        );
        result.errors++;
      }
    }

    results.push(result);
  }

  return results;
}

// ─── tables that contain encrypted columns ────────────────────────────────────
// Update this list if new encrypted columns are added to the schema.
const ENCRYPTED_TABLES: Array<{ model: string; columns: string[] }> = [
  // SAML provider private keys
  // { model: 'samlProvider', columns: ['privateKey'] },

  // Webhook secrets
  // { model: 'webhook', columns: ['secret'] },

  // NOTE: api_keys.key_hash stores a bcrypt hash, NOT an AES-encrypted value.
  // Do NOT include it here — bcrypt hashes cannot be re-encrypted this way.

  // Add your encrypted columns here as the schema evolves:
  // { model: 'yourModel', columns: ['encryptedField'] },
];

// ─── main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('');
  console.log('🔑  ENCRYPTION_MASTER_KEY Rotation');
  console.log('   Old key (first 8 chars):', OLD_KEY!.slice(0, 8) + '…');
  console.log('   New key (first 8 chars):', NEW_KEY!.slice(0, 8) + '…');
  console.log(DRY_RUN ? '   Mode: DRY RUN (no writes)' : '   Mode: LIVE (writes enabled)');
  console.log('');

  if (ENCRYPTED_TABLES.length === 0) {
    console.log(
      '⚠  No encrypted tables configured in ENCRYPTED_TABLES.\n' +
      '   Edit scripts/rotate-encryption-key.ts and uncomment the relevant entries\n' +
      '   before running this script in production.'
    );
    process.exit(0);
  }

  const db = await getDb();

  let totalErrors = 0;

  try {
    for (const { model, columns } of ENCRYPTED_TABLES) {
      console.log(`\n📋  Rotating ${model} (columns: ${columns.join(', ')})`);
      const results = await rotateTable(db, model, columns);

      for (const r of results) {
        const status = r.errors > 0 ? '✗' : '✔';
        console.log(
          `   ${status}  ${r.table}.${r.column}: ` +
          `${r.rotated} rotated, ${r.skipped} skipped, ${r.errors} errors  (total: ${r.total})`
        );
        totalErrors += r.errors;
      }
    }
  } finally {
    await db.$disconnect();
  }

  console.log('');

  if (totalErrors > 0) {
    console.error(`❌  Rotation completed with ${totalErrors} error(s). Review the output above.`);
    console.error('   Do NOT promote the new key until all errors are resolved.');
    process.exit(1);
  }

  if (DRY_RUN) {
    console.log('✅  Dry run complete. Re-run without --dry-run to apply changes.');
  } else {
    console.log('✅  Rotation complete.');
    console.log('');
    console.log('Next steps:');
    console.log('  1. Set ENCRYPTION_MASTER_KEY to the value of ENCRYPTION_MASTER_KEY_NEW');
    console.log('  2. Remove ENCRYPTION_MASTER_KEY_NEW from your environment');
    console.log('  3. Deploy and verify all encrypted services work correctly');
  }
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
