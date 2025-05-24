FROM node:20-slim as builder
RUN npm i -g pnpm

WORKDIR /app

COPY . .
RUN rm -rf /app/node_modules && pnpm install && pnpm run build

FROM node:20-slim as runner
COPY --from=public.ecr.aws/awsguru/aws-lambda-adapter:0.9.1 /lambda-adapter /opt/extensions/lambda-adapter

ENV PORT=8080 NODE_ENV=production
ENV AWS_LWA_ENABLE_COMPRESSION=true

# 设置启动超时时间为20秒
ENV AWS_LWA_READINESS_CHECK_TIMEOUT=20000
# 设置健康检查路径
ENV AWS_LWA_READINESS_CHECK_PATH=/health

WORKDIR ${LAMBDA_TASK_ROOT}
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules

# 添加健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8080/health || exit 1

CMD [ "node", "dist/main.js" ]
