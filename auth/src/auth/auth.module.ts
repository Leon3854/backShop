import { PrismaService } from '@/prisma.service';
import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RabbitMQService } from '@/shared/rabbitmq/rabbitmq.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { LocalStrategy } from './strategies/local.strategy';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RefreshJwtGuard } from './guards/refresh-jwt.guard';
import { RedisService } from '@/redis/redis.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';

@Module({
  imports: [
    ConfigModule.forRoot(),
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: configService.get<string>('JWT_ACCESS_EXPIRES_IN', '15m'),
        },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController],
  providers: [
    PrismaService,
    AuthService,
    RabbitMQService,
    JwtStrategy,
    LocalStrategy,
    JwtAuthGuard,
    RefreshJwtGuard,
    RedisService,
    ConfigService,
  ],
})
export class AuthModule {}
