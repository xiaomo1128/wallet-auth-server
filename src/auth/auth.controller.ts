import {
  Controller,
  Post,
  Body,
  Get,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(private authService: AuthService) {}

  @Get('nonce')
  getNonce() {
    const nonce = this.authService.generateNonce();
    this.logger.debug(`生成新nonce: ${nonce}`);
    return { nonce };
  }

  @Post('simple-verify')
  async verifySignature(
    @Body() body: { message: string; signature: string; address: string },
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

    this.logger.debug('开始简化签名验证...');

    const result = await this.authService.verifySignature(
      message,
      signature,
      address,
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
