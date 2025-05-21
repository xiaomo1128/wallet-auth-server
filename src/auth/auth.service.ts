import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserService } from '../user/user.service';
import { ethers } from 'ethers';

@Injectable()
export class AuthService {
  private nonces: Map<string, { nonce: string; expires: Date }> = new Map();
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private jwtService: JwtService,
    private userService: UserService,
  ) {}

  generateNonce(): string {
    const nonce = ethers.hexlify(ethers.randomBytes(16));
    const expires = new Date(Date.now() + 1000 * 60 * 5); // 5分钟有效期

    this.logger.debug(`生成新nonce: ${nonce}`);

    // 存储nonce
    this.nonces.set(nonce, { nonce, expires });

    // 清理过期的nonces
    this.cleanExpiredNonces();

    return nonce;
  }

  private cleanExpiredNonces() {
    const now = new Date();
    let expiredCount = 0;

    for (const [key, value] of this.nonces.entries()) {
      if (value.expires < now) {
        this.nonces.delete(key);
        expiredCount++;
      }
    }

    if (expiredCount > 0) {
      this.logger.debug(`清理了 ${expiredCount} 个过期nonce`);
    }
  }

  // 从简单消息中提取 nonce
  private extractNonceFromMessage(message: string): string | null {
    try {
      // 更新正则表达式，正确匹配0x开头的十六进制nonce
      const nonceMatch = message.match(/Nonce: (0x[a-f0-9]+|[a-f0-9]+)/i);
      if (nonceMatch && nonceMatch[1]) {
        this.logger.debug(`提取到的原始nonce字符串: '${nonceMatch[1]}'`);
        return nonceMatch[1];
      }
      return null;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`从简单消息提取nonce失败: ${errorMessage}`);
      return null;
    }
  }

  // 验证简单签名
  async verifySignature(
    message: string,
    signature: string,
    address: string,
  ): Promise<{
    success: boolean;
    data?: {
      token: string;
      address: string;
    };
    error?: string;
  }> {
    try {
      this.logger.debug(`开始验证简单签名...`);
      this.logger.debug(`收到的消息: ${message}`);
      this.logger.debug(`收到的签名: ${signature}`);
      this.logger.debug(`声明的地址: ${address}`);

      // 从消息中提取nonce
      const extractedNonce = this.extractNonceFromMessage(message);
      if (!extractedNonce) {
        this.logger.error('无法从消息中提取nonce');
        return { success: false, error: '无法从消息中提取nonce' };
      }

      // 验证nonce
      const storedNonce = this.nonces.get(extractedNonce);
      if (!storedNonce) {
        this.logger.warn(`未找到对应的nonce: ${extractedNonce}`);
        return { success: false, error: 'Invalid nonce' };
      }

      if (storedNonce.expires < new Date()) {
        this.logger.warn(`nonce已过期: ${extractedNonce}`);
        return { success: false, error: 'Expired nonce' };
      }

      // 使用ethers直接验证签名
      let recoveredAddress: string;
      try {
        recoveredAddress = ethers.verifyMessage(message, signature);
        this.logger.debug(`恢复的地址: ${recoveredAddress}`);
      } catch (err: unknown) {
        const errorMessage =
          err instanceof Error ? err.message : 'Unknown error';
        this.logger.error(`验证签名失败: ${errorMessage}`);
        return { success: false, error: `验证签名失败: ${errorMessage}` };
      }

      // 验证地址
      if (recoveredAddress.toLowerCase() !== address.toLowerCase()) {
        this.logger.warn(`地址不匹配: ${recoveredAddress} vs ${address}`);
        return { success: false, error: 'Address mismatch' };
      }

      // 删除已使用的nonce
      this.nonces.delete(extractedNonce);

      // 处理用户和令牌
      const user = await this.userService.findOrCreateUser(address);

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
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`验证过程中发生错误: ${errorMessage}`);
      return {
        success: false,
        error: errorMessage || '验证过程中发生错误',
      };
    }
  }
}
