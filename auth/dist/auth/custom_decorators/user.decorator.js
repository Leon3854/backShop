"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.User = void 0;
const common_1 = require("@nestjs/common");
exports.User = (0, common_1.createParamDecorator)((data, ctx) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;
    return user?.data ? user?.[data] : user;
});
getUser(, user, string);
{
    return await this.userService.findUser(user);
}
getById(, id, string);
{
    return await this.userService.gitById(id);
}
