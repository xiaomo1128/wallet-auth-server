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
        synchronize: configService.get('DB_SYNC', 'true') === 'true',
        logging: configService.get('NODE_ENV') === 'development',

        // 优化连接配置 - 针对 Serverless 环境
        extra: {
          max: 3, // 减少最大连接数
          min: 0, // 最小连接数设为0，按需创建
          idleTimeoutMillis: 15000, // 减少空闲超时到15秒
          connectionTimeoutMillis: 5000, // 减少连接超时到5秒
          acquireTimeoutMillis: 5000, // 减少获取连接超时到5秒
          maxUses: 1000, // 减少连接最大使用次数

          // 添加重试和心跳配置
          retryAttempts: 3,
          retryDelay: 1000,
          keepConnectionAlive: true,
          dropSchema: false,
        },

        // SSL 配置
        ssl:
          configService.get('NODE_ENV') === 'production'
            ? {
                rejectUnauthorized: false,
              }
            : false,
      }),
    }),
    CacheModule.registerAsync({
      isGlobal: true,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => {
        const redisHost = configService.get<string>('REDIS_HOST', 'localhost');
        const redisPort = parseInt(
          configService.get<string>('REDIS_PORT', '6379'),
        );
        const redisPassword = configService.get<string>('REDIS_PASSWORD', '');

        // 如果是生产环境且Redis配置不完整，使用内存缓存作为fallback
        if (configService.get('NODE_ENV') === 'production' && !redisHost) {
          console.log('Redis配置不完整，使用内存缓存');
          return {
            ttl: 300 * 1000, // 5分钟
          };
        }

        try {
          return {
            store: await redisStore({
              socket: {
                host: redisHost,
                port: redisPort,
                connectTimeout: 3000, // 减少连接超时到3秒
                lazyConnect: true,
                reconnectOnError: (err) => {
                  console.log(
                    'Redis reconnect on error:',
                    err instanceof Error ? err.message : String(err),
                  );
                  return true;
                },
              },
              password: redisPassword || undefined,
              ttl: 300 * 1000, // 5分钟缓存
              retryDelayOnFailover: 100,
              enableReadyCheck: false,
              maxRetriesPerRequest: 2, // 减少重试次数
              connectTimeout: 3000,
              commandTimeout: 2000,

              // 添加错误处理
              retryDelayOnClusterDown: 300,
              enableOfflineQueue: false,
            }),
          };
        } catch (error) {
          console.error('Redis连接失败，降级到内存缓存:', error);
          // 降级到内存缓存
          return {
            ttl: 300 * 1000,
          };
        }
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
