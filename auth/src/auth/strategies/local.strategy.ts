import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-local';
import { AuthService } from '../auth.service';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private authService: AuthService) {
    super({
      usernameField: 'email', //используем email вместо username
      passwordField: 'password', //явно указываем поле пароля
    });
  }
  async validate(email: string, password: string) {
    const user = await this.authService.validateUserByEmail(email, password);
    if (!user) {
      throw new UnauthorizedException();
    }
    return user;
  }
}
