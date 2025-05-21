import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  // 配置更宽松的CORS设置
  app.enableCors({
    origin: true, // 允许所有来源，开发时使用
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
    allowedHeaders: 'Content-Type,Authorization,X-Requested-With',
  });

  logger.log('CORS已配置，允许所有来源访问');

  const port = process.env.PORT || 3001;
  await app.listen(port);
  logger.log(`应用已启动，监听端口: ${port}`);
}
bootstrap();
