# 钱包签名认证问题解决方案

## 根本原因分析

从您提供的日志中，我发现了两个主要问题：

1. **最新的401错误原因：nonce提取失败**

   ```
   [Nest] 17377  - 2025/05/21 17:38:03   DEBUG [AuthService] 从消息中提取的nonce: 0
   [Nest] 17377  - 2025/05/21 17:38:03    WARN [AuthService] 未找到对应的nonce: 0
   ```

   当前的正则表达式在处理`0x`前缀的十六进制nonce时只提取了第一个字符"0"，导致nonce验证失败。

2. **控制器调用错误的验证方法**
   ```typescript
   @Post('simple-verify')
   async verifySimpleSignature(...) {
     // 错误：调用verifySignature而不是verifySimpleSignature
     const result = await this.authService.verifySignature(message, signature, address);
     // ...
   }
   ```
   虽然您已经实现了`verifySimpleSignature`方法，但控制器仍在调用`verifySignature`方法。

## 完整解决方案

### 1. 修复nonce提取正则表达式

在`auth.service.ts`中更新提取nonce的方法：

```typescript
private extractNonceFromMessage(message: string): string | null {
  try {
    // 更新正则表达式，正确匹配0x开头的十六进制nonce
    const nonceMatch = message.match(/Nonce: (0x[a-f0-9]+|[a-f0-9]+)/i);
    if (nonceMatch && nonceMatch[1]) {
      this.logger.debug(`提取到的原始nonce字符串: '${nonceMatch[1]}'`);
      return nonceMatch[1];
    }
    return null;
  } catch (error) {
    this.logger.error(`提取nonce失败: ${error.message}`);
    return null;
  }
}

// 同样修复简单消息的nonce提取
private extractNonceFromSimpleMessage(message: string): string | null {
  try {
    const nonceMatch = message.match(/Nonce: (0x[a-f0-9]+|[a-f0-9]+)/i);
    if (nonceMatch && nonceMatch[1]) {
      this.logger.debug(`提取到的原始nonce字符串: '${nonceMatch[1]}'`);
      return nonceMatch[1];
    }
    return null;
  } catch (error) {
    this.logger.error(`从简单消息提取nonce失败: ${error.message}`);
    return null;
  }
}
```

### 2. 确保控制器使用正确的验证方法

在`auth.controller.ts`中修改`simple-verify`路由：

```typescript
@Post('simple-verify')
async verifySimpleSignature(
  @Body() body: { message: string; signature: string; address: string },
) {
  this.logger.debug(`收到简化验证请求: ${JSON.stringify(body, null, 2)}`);

  const { message, signature, address } = body;

  // 参数验证...

  this.logger.debug('开始简化签名验证...');

  // 修正：使用正确的verifySimpleSignature方法
  const result = await this.authService.verifySimpleSignature(
    message,
    signature,
    address,
  );

  // 结果处理...
}
```

### 3. 强化前端日志记录

在前端的`AuthContext.tsx`中添加更多日志：

```typescript
const createSimpleSignMessage = async (address: string) => {
  const nonce = await fetchNonce();
  console.log('获取到的nonce:', nonce); // 确认nonce格式

  // 创建消息...
  const message = `Sign this message to authenticate with ${domain}.\n\nAddress: ${address}\nNonce: ${nonce}\nTimestamp: ${new Date().toISOString()}`;

  console.log('创建的简单消息:', message);
  return message;
};

const login = async () => {
  // ...

  // 添加更多日志以便调试
  console.log(
    '发送到后端的数据:',
    JSON.stringify(
      {
        message,
        signature,
        address: normalizedAddress,
      },
      null,
      2,
    ),
  );

  // ...
};
```

## 关键修复点总结

1. **正则表达式处理**：修改正则表达式以正确匹配带有`0x`前缀的十六进制nonce
2. **方法调用一致性**：确保控制器调用正确的验证方法
3. **日志增强**：添加更详细的日志记录，特别是在nonce提取和处理阶段
4. **错误处理完善**：添加更清晰的错误消息，便于调试

通过这些修改，您的钱包签名认证系统应该能够正常工作了。重启前后端服务后测试，您应该能够成功通过钱包签名完成认证流程。
