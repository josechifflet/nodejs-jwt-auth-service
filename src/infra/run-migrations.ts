import { execSync } from 'child_process';

import config from '@/config';

const runMigrations = () =>
  new Promise<void>((resolve, reject) => {
    try {
      execSync(
        `export DATABASE_URL=${config.DATABASE} && yarn prisma:migrate`,
        { stdio: 'inherit' },
      );
      resolve();
    } catch (err) {
      reject(err);
    }
  });

export default runMigrations;
