import { Inject, Injectable } from '@nestjs/common';
import { RedisClientType } from 'redis';

@Injectable()
export class RedisService {
  @Inject('REDIS_CLIENT')
  private readonly redisClient: RedisClientType;

  async hGetAll(key: string) {
    return this.redisClient.hGetAll(key);
  }

  async hGet(key: string, attr: string) {
    return this.redisClient.hGet(key, attr);
  }

  async hSet(key: string, data: Record<string, any>, ttl?: number) {
    for (const name in data) {
      await this.redisClient.hSet(key, name, data[name]);
    }
    if (ttl) {
      await this.redisClient.expire(key, ttl);
    }
  }
}
