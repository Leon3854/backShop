import { createParamDecorator, ExecutionContext, Get } from '@nestjs/common';

export const User = createParamDecorator(
  (data: string, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();

    const user = request.user;

    return user?.data ? user?.[data] : user;
  },
);


@Get('user')
async getUser(@User('user') user: string) {
	return await this.userService.findUser(user);
}

@Get(':id')
async getById(@User(':id') id: string) {
	return await this.userService.gitById(id);
}