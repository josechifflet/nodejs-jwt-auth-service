import prisma from '@/infra/prisma';

const flushDb = async () => {
  console.log('Flushing prisma...');
  const models = Object.keys(prisma).filter(
    (key) => !['_', '$'].includes(key[0]),
  );
  const promises = models.map((name) => {
    // @ts-expect-error - Prisma Client
    const model = prisma[name].name;
    return prisma.$queryRawUnsafe(`TRUNCATE TABLE "${model}" CASCADE`);
  });
  await Promise.all(promises);
};

export default flushDb;
