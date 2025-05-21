import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { SiweMessage } from 'siwe';
import { UserService } from '../user/user.service';

@Injectable()
export class AuthService {
  private nonces: Map<string, { nonce: string; expires: Date }> = new Map();

  constructor(
    private jwtService: JwtService,
    private userService: UserService,
  ) {}

  generateNonce(): string {
    // 生成随机字符串作为nonce
    const randomStr =
      Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15) +
      Date.now().toString(36);

    const nonce = randomStr;
    const expires = new Date(Date.now() + 1000 * 60 * 5); // 5分钟有效期

    // 存储nonce
    this.nonces.set(nonce, { nonce, expires });

    // 清理过期的nonces
    this.cleanExpiredNonces();

    return nonce;
  }

  private cleanExpiredNonces() {
    const now = new Date();
    for (const [key, value] of this.nonces.entries()) {
      if (value.expires < now) {
        this.nonces.delete(key);
      }
    }
  }

  async verifySignature(
    message: string,
    signature: string,
    address: string,
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const siweMessage = new SiweMessage(message);

      // 验证nonce是否存在且未过期
      const storedNonce = this.nonces.get(siweMessage.nonce);
      if (!storedNonce || storedNonce.expires < new Date()) {
        return { success: false, error: 'Invalid or expired nonce' };
      }

      // 验证签名
      const { success, data, error } = await this.verifySiweMessage(
        siweMessage,
        signature,
      );

      if (!success || !data) {
        return { success: false, error: error || 'Verification failed' };
      }

      // 验证地址是否匹配
      if (
        typeof data.address !== 'string' ||
        data.address.toLowerCase() !== address.toLowerCase()
      ) {
        return { success: false, error: 'Address mismatch' };
      }

      // 删除使用过的nonce
      this.nonces.delete(siweMessage.nonce);

      // 查找或创建用户
      const user = await this.userService.findOrCreateUser(address);

      // 生成JWT令牌
      const token = this.jwtService.sign({
        sub: user.id,
        address: user.address,
      });

      return {
        success: true,
        data: {
          token,
          address: user.address,
        },
      };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'An error occurred during verification';
      return {
        success: false,
        error: errorMessage,
      };
    }
  }
  private async verifySiweMessage(
    message: SiweMessage,
    signature: string,
  ): Promise<{ success: boolean; data?: Record<string, any>; error?: string }> {
    try {
      const data = await message.verify({ signature });
      return { success: true, data };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error occurred';
      return { success: false, error: errorMessage };
    }
  }
}
