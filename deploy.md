# 部署前检查清单

- AWS CLI 已配置且有足够权限
- 环境变量已正确设置
- VPC 和子网配置正确
- 安全组规则允许 Lambda 访问 RDS 和 Redis
- 数据库迁移脚本准备好
- 监控和日志配置完成

# 部署后验证

```bash
# 健康检查
curl https://your-api-endpoint/health

# 详细健康检查

curl https://your-api-endpoint/health/detailed

# 获取 nonce（测试基本功能）

curl https://your-api-endpoint/auth/nonce

chmod +x test_deployment.sh
./test_deployment.sh

# 部署测试环境
./deploy.sh staging

# 部署生产环境
./deploy.sh production

# 删除当前的 Serverless 部署
serverless remove --stage staging --region ap-northeast-1
```

# 监控和维护

- 设置 CloudWatch 告警
- 配置日志聚合
- 定期备份数据库
- 监控 Lambda 性能指标
- 设置成本告警

# 成本优化建议

- 使用 ARM64 架构（已配置）
- 合理设置 Lambda 内存和超时
- 使用预留并发避免冷启动（可选）
- **定期清理未使用的日志**
- 考虑使用 **Aurora Serverless v2** 替代 RDS（高可用场景）

# Serverless 配置和部署脚本的正常性

```bash
# 尝试打包您的应用但不会实际部署，如果配置中有语法错误会提前发现
npx serverless config:credentials --provider aws --key YOUR_AWS_KEY --secret YOUR_AWS_SECRET
npx serverless package --stage staging

# 执行部署前的干运行 (Dry-Run) | 显示将要创建的资源列表，但不会实际部署
npx serverless deploy --stage staging --noDeploy

```

# 为什么需要 Docker？

- Serverless Framework 使用 Docker 来构建容器镜像
- 你的 Lambda 函数使用容器部署模式
- 需要构建 ARM64 架构的镜像


