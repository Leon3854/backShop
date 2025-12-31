"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var AuthService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const bcrypt = __importStar(require("bcrypt"));
const rabbitmq_service_1 = require("../shared/rabbitmq/rabbitmq.service");
const prisma_service_1 = require("../prisma.service");
const generateId_1 = require("../utils/generateId");
const redis_service_1 = require("../redis/redis.service");
let AuthService = AuthService_1 = class AuthService {
    jwtService;
    rabbitMQService;
    prisma;
    redisService;
    logger = new common_1.Logger(AuthService_1.name);
    constructor(jwtService, rabbitMQService, prisma, redisService) {
        this.jwtService = jwtService;
        this.rabbitMQService = rabbitMQService;
        this.prisma = prisma;
        this.redisService = redisService;
    }
    // Аунтетификация пользователя
    async login(loginDto) {
        // Находим пользователя
        const user = await this.prisma.credentials.findUnique({
            where: { email: loginDto.email },
        });
        if (!user) {
            throw new common_1.UnauthorizedException('Invalid credentials');
        }
        // Проверяем пароль
        const isPasswordValid = await bcrypt.compare(loginDto.password, user.passwordHash);
        if (!isPasswordValid) {
            throw new common_1.UnauthorizedException('Invalid credentials');
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
    async register(registerDto) {
        // Проверяем, нет ли уже пользователя
        const existingUser = await this.prisma.credentials.findUnique({
            where: { email: registerDto.email },
        });
        if (existingUser) {
            throw new common_1.ConflictException('User already exists');
        }
        // Хэшируем пароль
        const passwordHash = await bcrypt.hash(registerDto.password, 12);
        const userId = (0, generateId_1.generateUserId)();
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
            eventId: (0, generateId_1.generateEventId)(),
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
    async logout(userId, accessToken, tokenExpiry) {
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
                eventId: (0, generateId_1.generateEventId)(),
                eventType: 'USER_LOGGED_OUT',
                timestamp: new Date().toISOString(),
                payload: { userId },
            });
            console.log(`User ${userId} logged out successfully`);
            return { message: 'Logged out successfully' };
        }
        catch (error) {
            console.error(`Logout failed for user ${userId}:`, error);
            throw new common_1.InternalServerErrorException('Logout failed');
        }
    }
    calculateTokenRemainingTime(expiryTimestamp) {
        const now = Math.floor(Date.now() / 1000);
        return Math.max(0, expiryTimestamp - now);
    }
    // ОБНОВЛЕНИЕ ТОКЕНОВ (REFRESH)
    async refreshTokens(userId) {
        // Проверяем существование пользователя
        const user = await this.prisma.credentials.findUnique({
            where: { userId },
        });
        if (!user) {
            throw new common_1.UnauthorizedException('User not found');
        }
        // Генерируем новые токены
        return this.generateTokens(userId);
    }
    // СМЕНА ПАРОЛЯ
    async changePassword(userId, changePasswordDto) {
        const user = await this.prisma.credentials.findUnique({
            where: { userId },
        });
        if (!user) {
            throw new common_1.UnauthorizedException('User not found');
        }
        // Проверяем старый пароль
        const isOldPasswordValid = await bcrypt.compare(changePasswordDto.oldPassword, user.passwordHash);
        if (!isOldPasswordValid) {
            throw new common_1.UnauthorizedException('Invalid old password');
        }
        // Хэшируем новый пароль
        const newPasswordHash = await bcrypt.hash(changePasswordDto.newPassword, 12);
        // Обновляем пароль в базе
        await this.prisma.credentials.update({
            where: { userId },
            data: { passwordHash: newPasswordHash },
        });
        return { message: 'Password changed successfully' };
    }
    // ВАЛИДАЦИЯ ПОЛЬЗОВАТЕЛЯ (для Passport.js)
    validateUser(userId) {
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
    async getProfile(userId) {
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
            throw new common_1.UnauthorizedException('User not found');
        }
        return user;
    }
    // УДАЛЕНИЕ АККАУНТА
    async deleteAccount(userId, password) {
        const user = await this.prisma.credentials.findUnique({
            where: { userId },
        });
        if (!user) {
            throw new common_1.UnauthorizedException('User not found');
        }
        // Проверяем пароль для подтверждения
        const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
        if (!isPasswordValid) {
            throw new common_1.UnauthorizedException('Invalid password');
        }
        // Удаляем учетные данные
        await this.prisma.credentials.delete({
            where: { userId },
        });
        // Отправляем сообщение о удалении пользователя
        await this.rabbitMQService.publish('user.events', 'user.delete', {
            eventId: (0, generateId_1.generateEventId)(),
            eventType: 'USER_DELETED',
            timestamp: new Date().toISOString(),
            payload: { userId },
        });
        return { message: 'Account deleted successfully' };
    }
    // ВАЛИДАЦИЯ ПО EMAIL И ПАРОЛЮ (для Local Strategy)
    async validateUserByEmail(email, password) {
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
    generateTokens(userId) {
        const accessToken = this.jwtService.sign({ sub: userId }, {
            expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
            secret: process.env.JWT_SECRET,
        });
        const refreshToken = this.jwtService.sign({ sub: userId }, {
            expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
            secret: process.env.JWT_REFRESH_SECRET,
        });
        return { accessToken, refreshToken };
    }
    // ПРОВЕРКА EMAIL (дополнительный метод)
    async checkEmailAvailability(email) {
        const existingUser = await this.prisma.credentials.findUnique({
            where: { email },
        });
        return { available: !existingUser };
    }
    // ВЕРИФИКАЦИЯ ТОКЕНА (дополнительный метод)
    async verifyToken(token) {
        try {
            const payload = await this.jwtService.verify(token, {
                secret: process.env.JWT_SECRET,
            });
            return { valid: true, payload };
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
        }
        catch (error) {
            return { valid: false };
        }
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = AuthService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [jwt_1.JwtService,
        rabbitmq_service_1.RabbitMQService,
        prisma_service_1.PrismaService,
        redis_service_1.RedisService])
], AuthService);
