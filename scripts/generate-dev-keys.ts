/**
 * Generates a local RS256 keypair for signing collaboration (Yjs) tokens.
 *
 * Production keys are mounted from the server and never committed. A fresh
 * clone has no private key, so run this once for local development:
 *
 *   npx tsx scripts/generate-dev-keys.ts
 *
 * Writes keys/jwt_2025.key and keys/jwt_2025.pub plus the copies the Yjs
 * service reads. Refuses to overwrite an existing private key unless --force.
 */
import { generateKeyPairSync } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

const TARGET_DIRS = ['keys', 'app/src/services/yjs/keys'];
const force = process.argv.includes('--force');

const existing = TARGET_DIRS.map((d) => path.join(d, 'jwt_2025.key')).filter((f) => fs.existsSync(f));
if (existing.length && !force) {
  console.error(`Private key already exists (${existing.join(', ')}). Re-run with --force to replace it.`);
  process.exit(1);
}

const { publicKey, privateKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

for (const dir of TARGET_DIRS) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'jwt_2025.key'), privateKey, { mode: 0o600 });
  fs.writeFileSync(path.join(dir, 'jwt_2025.pub'), publicKey);
  console.log(`Wrote ${dir}/jwt_2025.key and ${dir}/jwt_2025.pub`);
}
console.log('Development keys only. Never use them in production.');
