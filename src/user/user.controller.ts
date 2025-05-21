import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { UserService } from './user.service';

@Controller('user')
export class UserController {
  constructor(private userService: UserService) {}

  @UseGuards(AuthGuard('jwt'))
  @Get('profile')
  getProfile(
    @Request() req: { user: Record<string, unknown> },
  ): Record<string, unknown> {
    // req.user 是由 JwtStrategy 中的 validate 方法设置的
    return req.user;
  }
}
