import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { UserService } from '../user/user.service';

// 定义JWT负载接口
interface JwtPayload {
  sub: string;
  address: string;
  [key: string]: unknown;
}

// 定义用户接口（对应user.service.ts中的User）
interface User {
  id: string;
  address: string;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private userService: UserService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET') || 'sdfasas',
    });
  }

  /**
   * 验证JWT负载并返回用户
   * @param payload 解码后的JWT负载
   * @returns 验证后的用户对象
   */
  async validate(payload: JwtPayload): Promise<User> {
    const { sub: id, address } = payload;

    // 类型检查
    if (typeof id !== 'string' || typeof address !== 'string') {
      throw new UnauthorizedException('Invalid token payload');
    }

    const user = await this.userService.findUserById(id);

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // 地址匹配验证
    const userAddress = String(user.address).toLowerCase();
    const tokenAddress = address.toLowerCase();

    if (userAddress !== tokenAddress) {
      throw new UnauthorizedException('Invalid token');
    }

    return user;
  }
}
