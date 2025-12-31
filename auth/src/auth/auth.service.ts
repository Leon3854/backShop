import {
  Logger,
  Injectable,
  UnauthorizedException,
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { RabbitMQService } from '../shared/rabbitmq/rabbitmq.service';
import { PrismaService } from '../prisma.service';
import { RegisterDto } from './dto/register.dto';
import { generateUserId, generateEventId } from '../utils/generateId';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { RedisService } from '@/redis/redis.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  constructor(
    private readonly jwtService: JwtService,
    private readonly rabbitMQService: RabbitMQService,
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
  ) {}

  // Аунтетификация пользователя
  async login(loginDto: LoginDto) {
    // Находим пользователя
    const user = await this.prisma.credentials.findUnique({
      where: { email: loginDto.email },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Проверяем пароль
    const isPasswordValid = await bcrypt.compare(
      loginDto.password,
      user.passwordHash,
    );
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Генерируем токены
    const tokens = this.generateTokens(user.userId);

    return {
      userId: user.userId,
      email: user.email,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  // РЕГИСТРАЦИЯ ПОЛЬЗОВАТЕЛЯ
  async register(registerDto: RegisterDto) {
    // Проверяем, нет ли уже пользователя
    const existingUser = await this.prisma.credentials.findUnique({
      where: { email: registerDto.email },
    });

    if (existingUser) {
      throw new ConflictException('User already exists');
    }

    // Хэшируем пароль
    const passwordHash = await bcrypt.hash(registerDto.password, 12);
    const userId = generateUserId();

    // Сохраняем в auth DB
    const authUser = await this.prisma.credentials.create({
      data: {
        email: registerDto.email,
        passwordHash,
        userId,
      },
    });

    // Отправляем сообщение в RabbitMQ для создания пользователя
    // user.events - точка входа exchange куда отправляется сообщение
    // user.create - маршрут тема сообщения routing Key
    // eventId - уникальный идентификатор события (UUID обычно)
    // Позволяет отслеживать и дедуплицировать(удалять или объединять
    // повторяющиеся события (например, клики, покупки, просмотры),
    // чтобы каждое уникальное действие засчитывалось только один раз,) события
    // Пример: "evt_123e4567-e89b-12d3-a456-426614174000"
    // eventType: - Тип события в формате UPPER_SNAKE_CASE
    // Стандартное соглашение для event-driven архитектуры
    // timestamp -  Время создания события в ISO формате
    // Пример: "2024-01-15T10:30:00.123Z"
    // Позволяет определить порядок событий
    // payload - полезная нагрузака - данные события
    // Содержит минимально необходимую информацию для других сервисов
    // Другие сервисы могут расширять эти данные из своих БД
    await this.rabbitMQService.publish('user.events', 'user.create', {
      eventId: generateEventId(),
      eventType: 'USER_CREATED',
      timeStamp: new Date().toISOString(),
      payload: {
        userId: authUser.userId,
        email: registerDto.email,
        // Остальные поля опциональны - они будут в Users Service
      },
    });
    // Генерируем токены
    const tokens = this.generateTokens(authUser.userId);

    return {
      userId: authUser.userId,
      email: authUser.email,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  // ВЫХОД ПОЛЬЗОВАТЕЛЯ (LOGOUT)
  async logout(
    userId: string,
    accessToken?: string,
    tokenExpiry?: number,
  ): Promise<{ message: string }> {
    try {
      // 1. Инвалидируем(удаляем) refresh токен
      await this.redisService.invalidateRefreshToken(userId);

      // 2. Добавляем access token в blacklist
      if (accessToken && tokenExpiry) {
        const remainingTime = this.calculateTokenRemainingTime(tokenExpiry);
        if (remainingTime > 0) {
          await this.redisService.addToBlacklist(accessToken, remainingTime);
        }
      }

      // 3. Отправляем событие о выходе
      await this.rabbitMQService.publish('user.events', 'user.logout', {
        eventId: generateEventId(),
        eventType: 'USER_LOGGED_OUT',
        timestamp: new Date().toISOString(),
        payload: { userId },
      });

      console.log(`User ${userId} logged out successfully`);

      return { message: 'Logged out successfully' };
    } catch (error) {
      console.error(`Logout failed for user ${userId}:`, error);
      throw new InternalServerErrorException('Logout failed');
    }
  }

  private calculateTokenRemainingTime(expiryTimestamp: number): number {
    const now = Math.floor(Date.now() / 1000);
    return Math.max(0, expiryTimestamp - now);
  }

  // ОБНОВЛЕНИЕ ТОКЕНОВ (REFRESH)
  async refreshTokens(
    userId: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    // Проверяем существование пользователя
    const user = await this.prisma.credentials.findUnique({
      where: { userId },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Генерируем новые токены
    return this.generateTokens(userId);
  }

  // СМЕНА ПАРОЛЯ
  async changePassword(
    userId: string,
    changePasswordDto: ChangePasswordDto,
  ): Promise<{ message: string }> {
    const user = await this.prisma.credentials.findUnique({
      where: { userId },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Проверяем старый пароль
    const isOldPasswordValid = await bcrypt.compare(
      changePasswordDto.oldPassword,
      user.passwordHash,
    );

    if (!isOldPasswordValid) {
      throw new UnauthorizedException('Invalid old password');
    }

    // Хэшируем новый пароль
    const newPasswordHash = await bcrypt.hash(
      changePasswordDto.newPassword,
      12,
    );

    // Обновляем пароль в базе
    await this.prisma.credentials.update({
      where: { userId },
      data: { passwordHash: newPasswordHash },
    });

    return { message: 'Password changed successfully' };
  }

  // ВАЛИДАЦИЯ ПОЛЬЗОВАТЕЛЯ (для Passport.js)
  validateUser(userId: string) {
    return this.prisma.credentials.findUnique({
      where: { userId },
      select: {
        userId: true,
        email: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  // ПОЛУЧЕНИЕ ПРОФИЛЯ ПОЛЬЗОВАТЕЛЯ
  async getProfile(userId: string) {
    const user = await this.prisma.credentials.findUnique({
      where: { userId },
      select: {
        userId: true,
        email: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return user;
  }

  // УДАЛЕНИЕ АККАУНТА
  async deleteAccount(
    userId: string,
    password: string,
  ): Promise<{ message: string }> {
    const user = await this.prisma.credentials.findUnique({
      where: { userId },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Проверяем пароль для подтверждения
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid password');
    }

    // Удаляем учетные данные
    await this.prisma.credentials.delete({
      where: { userId },
    });

    // Отправляем сообщение о удалении пользователя
    await this.rabbitMQService.publish('user.events', 'user.delete', {
      eventId: generateEventId(),
      eventType: 'USER_DELETED',
      timestamp: new Date().toISOString(),
      payload: { userId },
    });

    return { message: 'Account deleted successfully' };
  }

  // ВАЛИДАЦИЯ ПО EMAIL И ПАРОЛЮ (для Local Strategy)
  async validateUserByEmail(email: string, password: string) {
    const user = await this.prisma.credentials.findUnique({
      where: { email },
    });

    if (user && (await bcrypt.compare(password, user.passwordHash))) {
      // Вместо деструктуризации создаем новый объект без passwordHash
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { passwordHash, ...result } = user;
      // const result = {
      //   userId: user.userId,
      //   email: user.email,
      //   createdAt: user.createdAt,
      //   updatedAt: user.updatedAt,
      // };
      return result;
    }

    return null;
  }

  // ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ
  private generateTokens(userId: string): {
    accessToken: string;
    refreshToken: string;
  } {
    const accessToken = this.jwtService.sign(
      { sub: userId },
      {
        expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
        secret: process.env.JWT_SECRET,
      },
    );

    const refreshToken = this.jwtService.sign(
      { sub: userId },
      {
        expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
        secret: process.env.JWT_REFRESH_SECRET,
      },
    );
    return { accessToken, refreshToken };
  }

  // ПРОВЕРКА EMAIL (дополнительный метод)
  async checkEmailAvailability(email: string): Promise<{ available: boolean }> {
    const existingUser = await this.prisma.credentials.findUnique({
      where: { email },
    });
    return { available: !existingUser };
  }

  // ВЕРИФИКАЦИЯ ТОКЕНА (дополнительный метод)
  async verifyToken(token: string): Promise<{ valid: boolean; payload?: any }> {
    try {
      const payload = await this.jwtService.verify(token, {
        secret: process.env.JWT_SECRET,
      });
      return { valid: true, payload };
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      return { valid: false };
    }
  }
}
