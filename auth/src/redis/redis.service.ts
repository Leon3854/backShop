import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';

@Injectable()
export class RedisService {
  private readonly redisClient: Redis;

  constructor(private configService: ConfigService) {
    this.redisClient = new Redis({
      host: this.configService.get('REDIS_HOST_DOCKER') || 'redis',
      port: parseInt(this.configService.get('REDIS_PORT') || '6379'),
    });
  }

  // Сохраняет refresh-токен пользователя на 7 дней
  async setRefreshToken(userId: string, token: string): Promise<void> {
    await this.redisClient.setex(
      `refresh_token:${userId}`, // в этот ключ запишем пользователя
      7 * 24 * 60 * 60, // 7 дней
      token,
    );
  }

  // Проверяет, совпадает ли токен с сохранённым в Redis
  async validateRefreshToken(userId: string, token: string): Promise<boolean> {
    const storedToken = await this.redisClient.get(`refresh_token:${userId}`);
    return storedToken === token;
  }

  // Удаляет refresh-токен пользователя (при выходе из системы)
  async invalidationRefreshToken(userId: string): Promise<void> {
    await this.redisClient.del(`refresh_token:${userId}`);
  }

  // Добавляет токен в чёрный список на указанное время
  async addToBlackList(token: string, seconds: number): Promise<void> {
    await this.redisClient.setex(`blacklist:${token}`, seconds, '1');
  }

  // Проверяет, находится ли токен в чёрном списке
  async isTokenBlackListed(token: string): Promise<boolean> {
    const result = await this.redisClient.exists(`blacklist:${token}`);
    return result === 1;
  }
}
