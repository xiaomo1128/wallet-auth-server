import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  try {
    const app = await NestFactory.create(AppModule);

    // 🔥 启动后立即测试 Redis 连接
    const cacheManager = app.get<Cache>(CACHE_MANAGER);

    try {
      // 简单的 ping 测试
      await cacheManager.set('startup-test', 'redis-works', 1000);
      const testResult = await cacheManager.get('startup-test');
      await cacheManager.del('startup-test');

      if (testResult === 'redis-works') {
        logger.log('✅ Redis 连接测试成功');
      } else {
        logger.warn('⚠️ Redis 连接异常：测试值不匹配');
      }
    } catch (redisError: unknown) {
      const errorMessage =
        redisError instanceof Error ? redisError.message : String(redisError);
      logger.error('❌ Redis 连接失败:', errorMessage);
      logger.warn('应用将继续启动，但缓存功能可能无法正常工作');
    }

    // 启用 CORS（如果需要）
    app.enableCors();

    const port = process.env.PORT || 3001;
    await app.listen(port);

    logger.log(`🚀 应用已启动，监听端口: ${port}`);
  } catch (error) {
    logger.error('应用启动失败:', error);
    process.exit(1);
  }
}

bootstrap().catch((err) => {
  console.error('Failed to bootstrap application:', err);
  process.exit(1);
});
