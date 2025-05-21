import {
  Controller,
  Post,
  Body,
  Get,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Get('nonce')
  getNonce() {
    return { nonce: this.authService.generateNonce() };
  }

  @Post('verify')
  async verifySignature(
    @Body() body: { message: string; signature: string; address: string },
  ): Promise<{ token: string }> {
    const { message, signature, address } = body;

    if (!message || !signature || !address) {
      throw new HttpException(
        'Message, signature and address are required',
        HttpStatus.BAD_REQUEST,
      );
    }

    const result = await this.authService.verifySignature(
      message,
      signature,
      address,
    );

    if (!result.success) {
      throw new HttpException(
        result.error || 'Verification failed',
        HttpStatus.UNAUTHORIZED,
      );
    }

    return result.data as { token: string };
  }
}
