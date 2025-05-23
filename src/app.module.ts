import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { HealthModule } from './health/health.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager';
import { redisStore } from 'cache-manager-redis-store';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get('DB_HOST', 'localhost'),
        port: parseInt(configService.get('DB_PORT', '5432')),
        username: configService.get('DB_USERNAME', 'postgres'),
        password: configService.get('DB_PASSWORD'),
        database: configService.get('DB_DATABASE', 'web3_auth_db'),
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        synchronize: configService.get('DB_SYNC', 'true') === 'true', // 字符串转布尔值
        logging: configService.get('NODE_ENV') === 'development',

        // Aurora Serverless v2 优化配置
        extra: {
          max: 5, // 最大连接数（Serverless 环境建议较小）
          min: 1, // 最小连接数
          idleTimeoutMillis: 30000, // 空闲超时 30秒
          connectionTimeoutMillis: 10000, // 连接超时 10秒
          maxUses: 7500, // 连接最大使用次数
          acquireTimeoutMillis: 10000, // 获取连接超时
        },

        // SSL 配置（Aurora 生产环境必须）
        ssl:
          configService.get('NODE_ENV') === 'production'
            ? {
                rejectUnauthorized: false,
              }
            : false,
      }),
    }),
    CacheModule.register({
      isGlobal: true,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => {
        const redisHost = configService.get<string>('REDIS_HOST', 'localhost');
        const redisPort = parseInt(
          configService.get<string>('REDIS_PORT', '6379'),
        );
        const redisPassword = configService.get<string>('REDIS_PASSWORD', '');

        return {
          store: await redisStore({
            socket: {
              host: redisHost,
              port: redisPort,
              connectTimeout: 10000, // 连接超时
              lazyConnect: true, // 延迟连接
            },
            password: redisPassword || undefined, // 空字符串转 undefined
            ttl: 300 * 1000, // 默认缓存5分钟 (毫秒)
            retryDelayOnFailover: 100,
            enableReadyCheck: false,
            maxRetriesPerRequest: 3,
          }),
        };
      },
    }),
    AuthModule,
    UserModule,
    HealthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
