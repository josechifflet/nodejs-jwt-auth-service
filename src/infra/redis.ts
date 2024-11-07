import IORedis, { Redis } from 'ioredis';

import config from '@/config';

class RedisService {
  private redis: Redis;
  public getRedis(): Redis {
    if (!this.redis) {
      this.redis = new IORedis({
        host: config.REDIS_HOST,
        password: config.REDIS_PASSWORD,
        port: config.REDIS_PORT,
      });
    }
    return this.redis;
  }
}

export default new RedisService().getRedis();
