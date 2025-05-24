#!/bin/bash

# Web3 Auth 系统一键部署脚本
# 使用方法：./deploy.sh [staging|production]

set -e  # 遇到错误立即退出

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日志函数
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

# 检查必要的工具
check_requirements() {
    log_info "检查部署环境..."
    
    # 检查 AWS CLI
    if ! command -v aws &> /dev/null; then
        log_error "AWS CLI 未安装，请先安装 AWS CLI"
        exit 1
    fi
    
    # 检查 Docker
    if ! command -v docker &> /dev/null; then
        log_error "Docker 未安装，请先安装 Docker"
        exit 1
    fi
    
    # 检查 Node.js
    if ! command -v node &> /dev/null; then
        log_error "Node.js 未安装，请先安装 Node.js"
        exit 1
    fi
    
    # 检查 pnpm
    if ! command -v pnpm &> /dev/null; then
        log_warning "pnpm 未安装，正在安装..."
        npm install -g pnpm
    fi
    
    # 检查 Serverless Framework
    if ! command -v serverless &> /dev/null; then
        log_warning "Serverless Framework 未安装，正在安装..."
        npm install -g serverless
    fi
    
    log_success "环境检查完成"
}

# 获取部署参数
get_deployment_params() {
    STAGE=${1:-staging}
    STACK_NAME="web3-auth-infra-${STAGE}"
    
    # 设置默认值
    DB_PASSWORD=${DB_PASSWORD:-"MySecurePassword123!"}
    JWT_SECRET=${JWT_SECRET:-"$(openssl rand -base64 32)"}
    REDIS_PASSWORD=${REDIS_PASSWORD:-"$(openssl rand -base64 16)"}
    
    log_info "部署参数："
    echo "  - 环境: ${STAGE}"
    echo "  - 栈名称: ${STACK_NAME}"
    echo "  - 区域: ap-northeast-1"
}

# 检查 AWS 凭证
check_aws_credentials() {
    log_info "检查 AWS 凭证..."
    
    if ! aws sts get-caller-identity &> /dev/null; then
        log_error "AWS 凭证未配置或已过期"
        log_info "请运行: aws configure"
        exit 1
    fi
    
    ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
    AWS_REGION="ap-northeast-1"
    
    log_success "AWS 凭证验证成功 (账户: ${ACCOUNT_ID})"
}

# 部署基础设施
deploy_infrastructure() {
    log_info "开始部署基础设施..."
    
    # 检查栈是否存在
    if aws cloudformation describe-stacks --stack-name "${STACK_NAME}" --region "${AWS_REGION}" &> /dev/null; then
        log_info "检查栈是否需要更新: ${STACK_NAME}"
        
        # 创建变更集来检查是否有更新
        CHANGE_SET_NAME="changeset-$(date +%s)"
        
        if aws cloudformation create-change-set \
            --stack-name "${STACK_NAME}" \
            --change-set-name "${CHANGE_SET_NAME}" \
            --template-body file://infrastructure.yml \
            --parameters \
                ParameterKey=Environment,ParameterValue="${STAGE}" \
                ParameterKey=DBPassword,ParameterValue="${DB_PASSWORD}" \
                ParameterKey=JWTSecret,ParameterValue="${JWT_SECRET}" \
                ParameterKey=RedisPassword,ParameterValue="${REDIS_PASSWORD}" \
            --capabilities CAPABILITY_IAM \
            --region "${AWS_REGION}" 2>/dev/null; then
            
            # 等待变更集创建完成
            sleep 5
            
            # 检查变更集状态
            CHANGE_SET_STATUS=$(aws cloudformation describe-change-set \
                --stack-name "${STACK_NAME}" \
                --change-set-name "${CHANGE_SET_NAME}" \
                --region "${AWS_REGION}" \
                --query 'Status' \
                --output text 2>/dev/null || echo "FAILED")
            
            if [ "${CHANGE_SET_STATUS}" = "CREATE_COMPLETE" ]; then
                log_info "执行基础设施更新..."
                aws cloudformation execute-change-set \
                    --stack-name "${STACK_NAME}" \
                    --change-set-name "${CHANGE_SET_NAME}" \
                    --region "${AWS_REGION}"
                
                log_info "等待更新完成..."
                aws cloudformation wait stack-update-complete \
                    --stack-name "${STACK_NAME}" \
                    --region "${AWS_REGION}"
                
                log_success "基础设施更新完成"
            else
                log_info "基础设施无需更新"
                # 删除无用的变更集
                aws cloudformation delete-change-set \
                    --stack-name "${STACK_NAME}" \
                    --change-set-name "${CHANGE_SET_NAME}" \
                    --region "${AWS_REGION}" 2>/dev/null || true
            fi
        else
            log_info "基础设施无需更新"
        fi
    else
        log_info "创建新栈: ${STACK_NAME}"
        aws cloudformation create-stack \
            --stack-name "${STACK_NAME}" \
            --template-body file://infrastructure.yml \
            --parameters \
                ParameterKey=Environment,ParameterValue="${STAGE}" \
                ParameterKey=DBPassword,ParameterValue="${DB_PASSWORD}" \
                ParameterKey=JWTSecret,ParameterValue="${JWT_SECRET}" \
                ParameterKey=RedisPassword,ParameterValue="${REDIS_PASSWORD}" \
            --capabilities CAPABILITY_IAM \
            --region "${AWS_REGION}"
        
        log_info "等待基础设施部署完成..."
        aws cloudformation wait stack-create-complete \
            --stack-name "${STACK_NAME}" \
            --region "${AWS_REGION}"
        
        log_success "基础设施部署完成"
    fi
}

# 安装依赖
install_dependencies() {
    log_info "安装项目依赖..."
    
    if [ -f "package.json" ]; then
        pnpm install
        log_success "依赖安装完成"
    else
        log_error "未找到 package.json 文件"
        exit 1
    fi
}

# 构建应用
build_application() {
    log_info "构建应用..."
    
    # 构建 NestJS 应用
    pnpm run build
    
    log_success "应用构建完成"
}

# 部署 Lambda 函数
deploy_lambda() {
    log_info "部署 Lambda 函数..."
    
    # 设置环境变量
    export JWT_SECRET="${JWT_SECRET}"
    export DB_PASSWORD="${DB_PASSWORD}"
    export REDIS_PASSWORD="${REDIS_PASSWORD}"
    
    # 使用 Serverless Framework 部署
    serverless deploy --stage "${STAGE}" --region "${AWS_REGION}" --verbose
    
    log_success "Lambda 函数部署完成"
}

# 获取部署信息
get_deployment_info() {
    log_info "获取部署信息..."
    
    # 获取 API 端点
    API_URL=$(aws cloudformation describe-stacks \
        --stack-name "serverless-web3-auth-${STAGE}" \
        --region "${AWS_REGION}" \
        --query 'Stacks[0].Outputs[?OutputKey==`HttpApiUrl`].OutputValue' \
        --output text 2>/dev/null || echo "未找到")
    
    # 获取数据库端点
    DB_ENDPOINT=$(aws cloudformation describe-stacks \
        --stack-name "${STACK_NAME}" \
        --region "${AWS_REGION}" \
        --query 'Stacks[0].Outputs[?OutputKey==`DatabaseEndpoint`].OutputValue' \
        --output text)
    
    # 获取 Redis 端点
    REDIS_ENDPOINT=$(aws cloudformation describe-stacks \
        --stack-name "${STACK_NAME}" \
        --region "${AWS_REGION}" \
        --query 'Stacks[0].Outputs[?OutputKey==`RedisEndpoint`].OutputValue' \
        --output text)
    
    echo
    log_success "=== 部署完成 ==="
    echo "环境: ${STAGE}"
    echo "API 端点: ${API_URL}"
    echo "数据库端点: ${DB_ENDPOINT}"
    echo "Redis 端点: ${REDIS_ENDPOINT}"
    echo
    echo "测试命令："
    echo "curl ${API_URL}/health"
    echo
}

# 健康检查
health_check() {
    if [ "${API_URL}" != "未找到" ] && [ -n "${API_URL}" ]; then
        log_info "执行健康检查..."
        
        # 等待服务启动
        sleep 10
        
        HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "${API_URL}/health" || echo "000")
        
        if [ "${HTTP_CODE}" = "200" ]; then
            log_success "健康检查通过！服务运行正常"
        else
            log_warning "健康检查失败 (HTTP ${HTTP_CODE})，请检查日志"
        fi
    else
        log_warning "跳过健康检查：未找到 API 端点"
    fi
}

# 主函数
main() {
    echo "🚀 Web3 Auth 系统部署开始"
    echo "================================"
    
    # 检查参数
    if [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
        echo "使用方法: $0 [staging|production]"
        echo "示例: $0 staging"
        exit 0
    fi
    
    # 执行部署步骤
    check_requirements
    get_deployment_params "$1"
    check_aws_credentials
    install_dependencies
    build_application
    deploy_infrastructure
    deploy_lambda
    get_deployment_info
    health_check
    
    echo
    log_success "🎉 部署完成！"
    echo "================================"
}

# 错误处理
trap 'log_error "部署过程中发生错误！"; exit 1' ERR

# 执行主函数
main "$@"