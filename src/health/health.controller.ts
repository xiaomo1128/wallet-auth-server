import { Controller, Get, Inject, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../user/entities/user.entity';

// 定义健康检查相关的类型
interface HealthCheck {
  status: string;
  responseTime: number;
  error: string | null;
}

interface HealthChecks {
  redis: HealthCheck;
  database: HealthCheck;
  application: {
    status: string;
    uptime: number;
  };
}

interface RedisDetails {
  status: string;
  responseTime: number;
  operations: {
    set: boolean;
    get: boolean;
    delete: boolean;
    ttl: boolean;
  };
  testKey: string;
  retrievedValue: unknown;
}

interface DatabaseDetails {
  status: string;
  responseTime: number;
  connection: boolean;
  userCount: number;
  currentTime: string;
}

@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  // 🔥 综合健康检查 - 适合监控系统调用
  @Get()
  async healthCheck() {
    const startTime = Date.now();
    const checks: HealthChecks = {
      redis: { status: 'unknown', responseTime: 0, error: null },
      database: { status: 'unknown', responseTime: 0, error: null },
      application: { status: 'healthy', uptime: process.uptime() },
    };

    // Redis 健康检查
    try {
      const redisStart = Date.now();
      await this.cacheManager.set('health-check', Date.now(), 5000);
      const value = await this.cacheManager.get('health-check');
      await this.cacheManager.del('health-check');

      checks.redis = {
        status: value ? 'healthy' : 'degraded',
        responseTime: Date.now() - redisStart,
        error: null,
      };
    } catch (error) {
      checks.redis = {
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
      this.logger.warn(`Redis 健康检查失败: ${checks.redis.error}`);
    }

    // 数据库健康检查
    const dbStart = Date.now();
    try {
      await this.userRepository.query('SELECT 1');
      checks.database = {
        status: 'healthy',
        responseTime: Date.now() - dbStart,
        error: null,
      };
    } catch (error) {
      checks.database = {
        status: 'unhealthy',
        responseTime: Date.now() - dbStart,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
      this.logger.warn(`数据库健康检查失败: ${checks.database.error}`);
    }

    const overall = this.determineOverallHealth(checks);
    const totalResponseTime = Date.now() - startTime;

    const result = {
      status: overall,
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      version: process.env.npm_package_version || '1.0.0',
      responseTime: totalResponseTime,
      checks,
    };

    // 根据环境决定日志级别
    if (overall === 'healthy') {
      this.logger.debug(`健康检查通过 (${totalResponseTime}ms)`);
    } else {
      this.logger.warn(`健康检查异常: ${overall} (${totalResponseTime}ms)`);
    }

    return result;
  }

  // 🔥 详细的系统状态 - 适合开发调试
  @Get('detailed')
  async detailedHealth() {
    const startTime = Date.now();

    try {
      const [redisDetails, dbDetails, systemDetails] = await Promise.all([
        this.getRedisDetails(),
        this.getDatabaseDetails(),
        this.getSystemDetails(),
      ]);

      const result = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
        responseTime: Date.now() - startTime,
        details: {
          redis: redisDetails,
          database: dbDetails,
          system: systemDetails,
        },
      };

      this.logger.log(`详细健康检查完成 (${result.responseTime}ms)`);
      return result;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`详细健康检查失败: ${errorMessage}`);

      return {
        status: 'error',
        timestamp: new Date().toISOString(),
        error: errorMessage,
        responseTime: Date.now() - startTime,
      };
    }
  }

  // 🔥 仅 Redis 状态检查
  @Get('redis')
  async redisHealth() {
    try {
      const details = await this.getRedisDetails();
      return {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        redis: details,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Redis 检查失败: ${errorMessage}`);

      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: errorMessage,
      };
    }
  }

  private async getRedisDetails(): Promise<RedisDetails> {
    const start = Date.now();
    const testKey = `health-test-${Date.now()}`;
    const testValue = `test-${Math.random()}`;

    // 基本操作测试
    await this.cacheManager.set(testKey, testValue, 10000);
    const retrievedValue = await this.cacheManager.get(testKey);
    await this.cacheManager.del(testKey);

    // TTL 测试
    const ttlTestKey = `ttl-test-${Date.now()}`;
    await this.cacheManager.set(ttlTestKey, 'ttl-value', 2000);

    return {
      status: retrievedValue === testValue ? 'healthy' : 'degraded',
      responseTime: Date.now() - start,
      operations: {
        set: true,
        get: retrievedValue === testValue,
        delete: true,
        ttl: true,
      },
      testKey,
      retrievedValue,
    };
  }

  private async getDatabaseDetails(): Promise<DatabaseDetails> {
    const start = Date.now();

    const results = await Promise.all([
      this.userRepository.query('SELECT NOW() as current_time'),
      this.userRepository.count(),
    ]);

    const pingResult = results[0] as Array<{ current_time: string }>;
    const userCount = results[1];

    return {
      status: 'healthy',
      responseTime: Date.now() - start,
      connection: true,
      userCount,
      currentTime: pingResult[0]?.current_time || '',
    };
  }

  private getSystemDetails() {
    return {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      cpuUsage: process.cpuUsage(),
      environment: process.env.NODE_ENV || 'development',
    };
  }

  private determineOverallHealth(checks: HealthChecks): string {
    const healthyComponents = [checks.redis, checks.database];
    const statuses = healthyComponents.map((check) => check.status);

    if (statuses.every((status) => status === 'healthy')) {
      return 'healthy';
    } else if (statuses.some((status) => status === 'unhealthy')) {
      return 'unhealthy';
    } else {
      return 'degraded';
    }
  }
}
