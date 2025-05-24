#!/bin/bash

# Web3 Auth 系统部署测试脚本

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# API 端点
API_GATEWAY_URL="https://2pd3icss09.execute-api.ap-northeast-1.amazonaws.com"
FUNCTION_URL="https://a5z2h3qluon2wqozd44cldzyzi0nrrpd.lambda-url.ap-northeast-1.on.aws"

echo "🧪 Web3 Auth API 测试"
echo "========================"

# 测试 1: 基本连接测试
log_info "测试 1: 基本连接测试"
echo "API Gateway URL: ${API_GATEWAY_URL}"
echo "Function URL: ${FUNCTION_URL}"
echo

# 测试 API Gateway 根端点
log_info "测试 API Gateway 根端点..."
HTTP_CODE=$(curl -s -o /tmp/response.txt -w "%{http_code}" "${API_GATEWAY_URL}/")
RESPONSE=$(cat /tmp/response.txt)

if [ "${HTTP_CODE}" = "200" ]; then
    log_success "API Gateway 根端点响应正常 (${HTTP_CODE})"
    echo "响应: ${RESPONSE}"
else
    log_warning "API Gateway 根端点异常 (${HTTP_CODE})"
    echo "响应: ${RESPONSE}"
fi
echo

# 测试 Function URL 根端点
log_info "测试 Function URL 根端点..."
HTTP_CODE=$(curl -s -o /tmp/response.txt -w "%{http_code}" "${FUNCTION_URL}")
RESPONSE=$(cat /tmp/response.txt)

if [ "${HTTP_CODE}" = "200" ]; then
    log_success "Function URL 根端点响应正常 (${HTTP_CODE})"
    echo "响应: ${RESPONSE}"
else
    log_warning "Function URL 根端点异常 (${HTTP_CODE})"
    echo "响应: ${RESPONSE}"
fi
echo

# 测试 2: 健康检查端点
log_info "测试 2: 健康检查端点"

# 测试 API Gateway 健康检查
log_info "测试 API Gateway 健康检查..."
HTTP_CODE=$(curl -s -o /tmp/response.txt -w "%{http_code}" "${API_GATEWAY_URL}/health")
RESPONSE=$(cat /tmp/response.txt)

if [ "${HTTP_CODE}" = "200" ]; then
    log_success "健康检查通过 (${HTTP_CODE})"
    echo "响应: ${RESPONSE}" | jq '.' 2>/dev/null || echo "响应: ${RESPONSE}"
else
    log_warning "健康检查失败 (${HTTP_CODE})"
    echo "响应: ${RESPONSE}"
fi
echo

# 测试 Function URL 健康检查
log_info "测试 Function URL 健康检查..."
HTTP_CODE=$(curl -s -o /tmp/response.txt -w "%{http_code}" "${FUNCTION_URL}/health")
RESPONSE=$(cat /tmp/response.txt)

if [ "${HTTP_CODE}" = "200" ]; then
    log_success "Function URL 健康检查通过 (${HTTP_CODE})"
    echo "响应: ${RESPONSE}" | jq '.' 2>/dev/null || echo "响应: ${RESPONSE}"
else
    log_warning "Function URL 健康检查失败 (${HTTP_CODE})"
    echo "响应: ${RESPONSE}"
fi
echo

# 测试 3: 认证端点
log_info "测试 3: 认证端点"

# 测试 nonce 端点
log_info "测试 nonce 生成..."
HTTP_CODE=$(curl -s -o /tmp/response.txt -w "%{http_code}" "${API_GATEWAY_URL}/auth/nonce")
RESPONSE=$(cat /tmp/response.txt)

if [ "${HTTP_CODE}" = "200" ]; then
    log_success "Nonce 生成成功 (${HTTP_CODE})"
    echo "响应: ${RESPONSE}" | jq '.' 2>/dev/null || echo "响应: ${RESPONSE}"
else
    log_warning "Nonce 生成失败 (${HTTP_CODE})"
    echo "响应: ${RESPONSE}"
fi
echo

# 测试带地址的 nonce 端点
TEST_ADDRESS="0x742d35Cc6563C065C56F395Ae0A5a58c49bEF8cF"
log_info "测试带地址的 nonce 生成..."
HTTP_CODE=$(curl -s -o /tmp/response.txt -w "%{http_code}" "${API_GATEWAY_URL}/auth/nonce?address=${TEST_ADDRESS}")
RESPONSE=$(cat /tmp/response.txt)

if [ "${HTTP_CODE}" = "200" ]; then
    log_success "带地址的 nonce 生成成功 (${HTTP_CODE})"
    echo "响应: ${RESPONSE}" | jq '.' 2>/dev/null || echo "响应: ${RESPONSE}"
else
    log_warning "带地址的 nonce 生成失败 (${HTTP_CODE})"
    echo "响应: ${RESPONSE}"
fi
echo

# 测试 4: Lambda 函数状态
log_info "测试 4: Lambda 函数状态"

# 检查 Lambda 函数配置
log_info "检查 Lambda 函数配置..."
aws lambda get-function-configuration \
    --function-name serverless-web3-auth-staging-api \
    --region ap-northeast-1 \
    --query '{
        State: State,
        StateReason: StateReason,
        LastUpdateStatus: LastUpdateStatus,
        MemorySize: MemorySize,
        Timeout: Timeout,
        Environment: Environment.Variables
    }' \
    --output table 2>/dev/null && log_success "Lambda 函数配置正常" || log_warning "无法获取 Lambda 函数配置"

echo

# 测试 5: 查看最新日志
log_info "测试 5: 查看最新日志"
log_info "获取最新的 Lambda 日志..."

# 获取最新日志流
LATEST_LOG_STREAM=$(aws logs describe-log-streams \
    --log-group-name "/aws/lambda/serverless-web3-auth-staging-api" \
    --region ap-northeast-1 \
    --order-by LastEventTime \
    --descending \
    --max-items 1 \
    --query 'logStreams[0].logStreamName' \
    --output text 2>/dev/null)

if [ "${LATEST_LOG_STREAM}" != "None" ] && [ -n "${LATEST_LOG_STREAM}" ]; then
    log_success "找到最新日志流: ${LATEST_LOG_STREAM}"
    
    # 获取最新日志事件
    log_info "获取最新日志事件..."
    aws logs get-log-events \
        --log-group-name "/aws/lambda/serverless-web3-auth-staging-api" \
        --log-stream-name "${LATEST_LOG_STREAM}" \
        --region ap-northeast-1 \
        --start-from-head \
        --query 'events[-10:].message' \
        --output text 2>/dev/null || log_warning "无法获取日志事件"
else
    log_warning "未找到日志流，函数可能还未执行"
fi

echo
echo "=== 测试完成 ==="
echo
echo "💡 故障排除建议："
echo "1. 如果健康检查失败，请等待几分钟后重试（冷启动）"
echo "2. 检查 Lambda 日志以获取详细错误信息"
echo "3. 确认数据库和 Redis 连接配置正确"
echo "4. 如果问题持续，可以重新部署函数"
echo
echo "📖 有用的命令："
echo "- 查看实时日志: aws logs tail /aws/lambda/serverless-web3-auth-staging-api --follow --region ap-northeast-1"
echo "- 重新部署: ./deploy.sh staging"
echo "- 删除并重新创建: serverless remove --stage staging && ./deploy.sh staging"

# 清理临时文件
rm -f /tmp/response.txt
