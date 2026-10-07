import { execSync } from 'node:child_process';

const testDatabaseUrl = 'postgresql://gigabox:gigabox@localhost:5432/gigabox_test?schema=public';

export default function globalSetup() {
  execSync('npx prisma migrate deploy', {
    cwd: process.cwd(),
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: testDatabaseUrl },
  });
}
