import { createHash, randomInt } from 'node:crypto';

const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const requested = Number.parseInt(process.argv[2] || '10', 10);
if (!Number.isSafeInteger(requested) || requested < 1 || requested > 100) {
  throw new Error('Count must be between 1 and 100.');
}

function generateCode() {
  const groups = Array.from({ length: 4 }, () =>
    Array.from({ length: 4 }, () => alphabet[randomInt(alphabet.length)]).join(''));
  return `MM-${groups.join('-')}`;
}

function hashCode(code) {
  return createHash('sha256').update(`mega-miyya-access-code:v1:${code}`).digest('hex');
}

const codes = Array.from({ length: requested }, generateCode);
const documents = codes.map((code, index) => ({
  codeHash: hashCode(code),
  label: `invite-${String(index + 1).padStart(2, '0')}`,
  status: 'unused',
}));

console.log('PLAINTEXT CODES — share each code once; do not store this list in the repository:');
codes.forEach((code, index) => console.log(`${String(index + 1).padStart(2, '0')}. ${code}`));
console.log('\nMONGOSH COMMAND — run in the same database used by MONGODB_URI:');
console.log(`db.accesscodes.insertMany(${JSON.stringify(documents, null, 2)})`);
