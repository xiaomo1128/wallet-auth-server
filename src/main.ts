import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { INestApplication } from '@nestjs/common';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const startTime = Date.now();

  try {
    logger.log('🚀 开始启动应用程序...');
    // 🔥 设置启动超时保护（15秒）
    const app = (await Promise.race([
      NestFactory.create(AppModule, {
        logger:
          process.env.NODE_ENV === 'production'
            ? ['error', 'warn', 'log']
            : ['error', 'warn', 'log', 'debug', 'verbose'],
      }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('应用启动超时 - 超过15秒')), 15000),
      ),
    ])) as INestApplication;

    logger.log(`✅ NestJS 应用创建成功 (${Date.now() - startTime}ms)`);

    // 🔥 启用关闭钩子（Serverless 环境重要）
    app.enableShutdownHooks();

    // 启用 CORS
    app.enableCors();

    // 🔥 异步测试 Redis 连接（不阻塞启动）
    const testRedisConnection = async () => {
      try {
        const cacheManager = app.get<Cache>(CACHE_MANAGER);

        // 设置超时的 Redis 测试
        await Promise.race([
          (async () => {
            await cacheManager.set('startup-test', 'redis-works', 1000);
            const testResult = await cacheManager.get('startup-test');
            await cacheManager.del('startup-test');

            if (testResult === 'redis-works') {
              logger.log('✅ Redis 连接测试成功');
            } else {
              logger.warn('⚠️ Redis 连接异常：测试值不匹配');
            }
          })(),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Redis 连接测试超时')), 3000),
          ),
        ]);
      } catch (redisError: unknown) {
        const errorMessage =
          redisError instanceof Error ? redisError.message : String(redisError);
        logger.warn('⚠️ Redis 连接测试失败:', errorMessage);
        logger.warn('应用将继续运行，Redis 功能可能受影响');
      }
    };

    const port = process.env.PORT || 3001;

    // 🔥 启动服务器
    await app.listen(port, '0.0.0.0'); // 确保监听所有接口

    const bootTime = Date.now() - startTime;
    logger.log(`🎉 应用启动成功！监听端口: ${port}，总启动时间: ${bootTime}ms`);

    // 🔥 记录环境信息
    logger.log(`📊 环境信息:`);
    logger.log(`  - NODE_ENV: ${process.env.NODE_ENV || 'development'}`);
    logger.log(`  - DB_HOST: ${process.env.DB_HOST || 'localhost'}`);
    logger.log(`  - REDIS_HOST: ${process.env.REDIS_HOST || 'localhost'}`);
    logger.log(
      `  - 内存使用: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`,
    );

    // 🔥 在后台异步测试 Redis（不阻塞启动完成）
    testRedisConnection().catch(() => {
      // 静默处理，已经在函数内部记录日志
    });
  } catch (error) {
    const bootTime = Date.now() - startTime;
    logger.error(`💥 应用启动失败 (${bootTime}ms):`, error);

    // 🔥 在 Serverless 环境中，可能不需要立即退出
    if (process.env.NODE_ENV !== 'production') {
      process.exit(1);
    } else {
      // 生产环境下记录错误但不退出，让容器重启
      throw error;
    }
  }
}

// 🔥 改进的错误处理
process.on('unhandledRejection', (reason, promise) => {
  console.error('🚨 未处理的Promise拒绝:', reason);
  console.error('Promise:', promise);
  // 在 Serverless 环境中不立即退出
});

process.on('uncaughtException', (error) => {
  console.error('🚨 未捕获的异常:', error);
  // 在 Serverless 环境中不立即退出，但记录错误
});

// 🔥 优雅关闭处理
process.on('SIGTERM', () => {
  console.log('📴 收到 SIGTERM 信号，准备关闭应用...');
});

process.on('SIGINT', () => {
  console.log('📴 收到 SIGINT 信号，准备关闭应用...');
});

bootstrap().catch((err) => {
  console.error('💥 应用启动引导失败:', err);
  // 在生产环境中可能不需要立即退出
  if (process.env.NODE_ENV !== 'production') {
    process.exit(1);
  }
});
