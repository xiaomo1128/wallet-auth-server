import { Injectable, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject } from '@nestjs/common';
import { Cache } from 'cache-manager';
import { ethers } from 'ethers';
import { JwtService } from '@nestjs/jwt';
import { UserService } from '../user/user.service';
import { InjectRepository } from '@nestjs/typeorm';
import { LoginHistory } from '../user/entities/login-history.entity';
import { User } from '../user/entities/user.entity';
import { Repository } from 'typeorm';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly NONCE_PREFIX = 'nonce:';
  private readonly NONCE_EXPIRY = 300; // 5分钟（秒）

  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private jwtService: JwtService,
    private userService: UserService,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(LoginHistory)
    private loginHistoryRepository: Repository<LoginHistory>,
  ) {}

  async generateNonce(): Promise<string> {
    const nonce = ethers.hexlify(ethers.randomBytes(16));
    this.logger.debug(`生成新nonce: ${nonce}`);

    // 存储nonce到Redis，设置5分钟过期时间
    await this.cacheManager.set(
      this.NONCE_PREFIX + nonce,
      true,
      this.NONCE_EXPIRY * 1000,
    );

    return nonce;
  }

  // 验证nonce是否有效并删除
  private async validateAndRemoveNonce(nonce: string): Promise<boolean> {
    const key = this.NONCE_PREFIX + nonce;
    const exists = await this.cacheManager.get(key);

    if (exists) {
      // 使用后立即删除nonce
      await this.cacheManager.del(key);
      return true;
    }

    return false;
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
    ipAddress?: string,
    userAgent?: string,
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
      const nonceValid = await this.validateAndRemoveNonce(extractedNonce);
      if (!nonceValid) {
        this.logger.warn(`nonce无效或已过期: ${extractedNonce}`);
        return { success: false, error: 'Invalid or expired nonce' };
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
      if (recoveredAddress.toLowerCase() === address.toLowerCase()) {
        // 处理用户和令牌
        const user = await this.userService.findOrCreateUser(address);

        // 记录成功登录
        await this.recordLogin(user.id, true, ipAddress, userAgent);

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
      } else {
        // 记录失败登录尝试
        const user = await this.userService.findUserByAddress(address);
        if (user) {
          await this.recordLogin(
            user.id,
            false,
            ipAddress,
            userAgent,
            'Address mismatch',
          );
        }

        return { success: false, error: 'Address mismatch' };
      }
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

  // 记录登录历史
  async recordLogin(
    userId: string,
    success: boolean,
    ipAddress?: string,
    userAgent?: string,
    failureReason?: string,
  ): Promise<LoginHistory> {
    // 记录登录历史
    const loginRecord = this.loginHistoryRepository.create({
      userId,
      ipAddress,
      userAgent,
      success,
      failureReason,
    });

    await this.loginHistoryRepository.save(loginRecord);

    // 如果登录成功，更新用户的登录计数和最后登录时间
    if (success) {
      await this.userRepository.update(
        { id: userId },
        {
          lastLoginAt: new Date(),
          loginCount: () => 'login_count + 1',
        },
      );
    }

    return loginRecord;
  }
}
