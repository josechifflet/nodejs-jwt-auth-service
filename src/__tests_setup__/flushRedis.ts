import redis from '../infra/redis';

const flushRedis = async () => {
  console.log('Flushing redis...');
  await redis.flushall();
};

export default flushRedis;
