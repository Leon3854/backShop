"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthModule = void 0;
const prisma_service_1 = require("../prisma.service");
const common_1 = require("@nestjs/common");
const auth_service_1 = require("./auth.service");
const rabbitmq_service_1 = require("../shared/rabbitmq/rabbitmq.service");
const jwt_strategy_1 = require("./strategies/jwt.strategy");
const local_strategy_1 = require("./strategies/local.strategy");
const jwt_auth_guard_1 = require("./guards/jwt-auth.guard");
const refresh_jwt_guard_1 = require("./guards/refresh-jwt.guard");
const redis_service_1 = require("../redis/redis.service");
const config_1 = require("@nestjs/config");
const auth_controller_1 = require("./auth.controller");
const passport_1 = require("@nestjs/passport");
const jwt_1 = require("@nestjs/jwt");
let AuthModule = class AuthModule {
};
exports.AuthModule = AuthModule;
exports.AuthModule = AuthModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot(),
            passport_1.PassportModule,
            jwt_1.JwtModule.registerAsync({
                imports: [config_1.ConfigModule],
                useFactory: (configService) => ({
                    secret: configService.get('JWT_SECRET'),
                    signOptions: {
                        expiresIn: configService.get('JWT_ACCESS_EXPIRES_IN', '15m'),
                    },
                }),
                inject: [config_1.ConfigService],
            }),
        ],
        controllers: [auth_controller_1.AuthController],
        providers: [
            prisma_service_1.PrismaService,
            auth_service_1.AuthService,
            rabbitmq_service_1.RabbitMQService,
            jwt_strategy_1.JwtStrategy,
            local_strategy_1.LocalStrategy,
            jwt_auth_guard_1.JwtAuthGuard,
            refresh_jwt_guard_1.RefreshJwtGuard,
            redis_service_1.RedisService,
            config_1.ConfigService,
        ],
    })
], AuthModule);
