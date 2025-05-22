import {
  Controller,
  Post,
  Body,
  Get,
  HttpException,
  HttpStatus,
  Logger,
  Query,
  Req,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { Request } from 'express';

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(private authService: AuthService) {}

  // 支持为特定地址生成绑定的 nonce
  @Get('nonce')
  async getNonce(@Query('address') address?: string) {
    // 如果提供了地址，生成绑定的 nonce
    const nonce = await this.authService.generateNonce(address);

    if (address) {
      this.logger.debug(`为地址 ${address} 生成绑定nonce: ${nonce}`);
    } else {
      this.logger.debug(`生成通用nonce: ${nonce}`);
    }

    return {
      nonce,
      bindAddress: address || null,
      message: address
        ? `为地址 ${address} 生成的绑定 nonce`
        : '生成的通用 nonce（建议与地址绑定使用）',
    };
  }

  @Post('simple-verify')
  async verifySignature(
    @Body() body: { message: string; signature: string; address: string },
    @Req() req: Request,
  ) {
    this.logger.debug(`收到简化验证请求: ${JSON.stringify(body, null, 2)}`);

    const { message, signature, address } = body;

    if (!message) {
      this.logger.warn('缺少message参数');
      throw new HttpException('Message is required', HttpStatus.BAD_REQUEST);
    }

    if (!signature) {
      this.logger.warn('缺少signature参数');
      throw new HttpException('Signature is required', HttpStatus.BAD_REQUEST);
    }

    if (!address) {
      this.logger.warn('缺少address参数');
      throw new HttpException('Address is required', HttpStatus.BAD_REQUEST);
    }

    // 获取客户端IP和User-Agent
    const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';
    const userAgent = req.get('User-Agent') || 'unknown';

    this.logger.debug('开始简化签名验证...');

    const result = await this.authService.verifySignature(
      message,
      signature,
      address,
      ipAddress,
      userAgent,
    );

    if (!result.success) {
      this.logger.warn(`验证失败: ${result.error}`);
      throw new HttpException(
        result.error || 'Verification failed',
        HttpStatus.UNAUTHORIZED,
      );
    }

    this.logger.debug('验证成功，返回token');
    return result.data;
  }
}
