import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RefreshJwtGuard } from './guards/refresh-jwt.guard';
import { ChangePasswordDto } from './dto/change-password.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  //Login
  @Get('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: LoginDto) {
    return await this.authService.login(loginDto);
  }

  //Регистрация
  @Post('register')
  async register(@Body() registerDto: RegisterDto) {
    return await this.authService.register(registerDto);
  }

  // ВЫХОД
  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Request() req) {
    const token = req.headers.authorization?.replace('Bearer ', '');
    const decoded = this.authService['jwtService'].decode(token);
    return await this.authService.logout(req.user.userId, token, decoded?.exp);
  }

  // ОБНОВЛЕНИЕ ТОКЕНОВ
  @UseGuards(RefreshJwtGuard)
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refreshTokens(@Request() req) {
    return this.authService.refreshTokens(req.user.userId);
  }

  // СМЕНА ПАРОЛЯ
  @UseGuards(JwtAuthGuard)
  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @Request() req,
    @Body() changePasswordDto: ChangePasswordDto,
  ) {
    return await this.authService.changePassword(
      req.user.userId,
      changePasswordDto,
    );
  }

  // ПОЛУЧЕНИЕ ПРОФИЛЯ
  @UseGuards(JwtAuthGuard)
  @Get('profile')
  async getProfile(@Request() req) {
    return this.authService.getProfile(req.user.userId);
  }

  // УДАЛЕНИЕ АККАУНТА
  @UseGuards(JwtAuthGuard)
  @Delete('account')
  async deleteAccount(@Request() req, @Body() body: { password: string }) {
    return this.authService.deleteAccount(req.user.userId, body.password);
  }

  // ПРОВЕРКА EMAIL
  @Post('check-email')
  async checkEmailAvailability(@Body() body: { email: string }) {
    return this.authService.checkEmailAvailability(body.email);
  }

  // ВЕРИФИКАЦИЯ ТОКЕНА
  @Post('verify-token')
  async verifyToken(@Body() body: { token: string }) {
    return this.authService.verifyToken(body.token);
  }

  // ВАЛИДАЦИЯ ПОЛЬЗОВАТЕЛЯ (для тестов)
  @UseGuards(JwtAuthGuard)
  @Get('validate')
  async validateUser(@Request() req) {
    return await this.authService.validateUser(req.user.userId);
  }
}
