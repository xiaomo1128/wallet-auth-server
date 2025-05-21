import { Injectable } from '@nestjs/common';

// 这里使用内存存储用户信息，实际应用中应该使用数据库
interface User {
  id: string;
  address: string;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class UserService {
  private users: Map<string, User> = new Map();

  findUserByAddress(address: string): Promise<User | undefined> {
    address = address.toLowerCase();

    for (const user of this.users.values()) {
      if (user.address.toLowerCase() === address) {
        return Promise.resolve(user);
      }
    }

    return Promise.resolve(undefined);
  }

  findUserById(id: string): Promise<User | undefined> {
    return Promise.resolve(this.users.get(id));
  }

  async findOrCreateUser(address: string): Promise<User> {
    address = address.toLowerCase();

    // 查找现有用户
    const existingUser = await this.findUserByAddress(address);
    if (existingUser) {
      // 更新最后访问时间
      existingUser.updatedAt = new Date();
      this.users.set(existingUser.id, existingUser);
      return existingUser;
    }

    // 创建新用户
    const now = new Date();
    const newUser: User = {
      id: Math.random().toString(36).substr(2, 9), // 简单的ID生成，实际应用中应使用UUID
      address,
      createdAt: now,
      updatedAt: now,
    };

    this.users.set(newUser.id, newUser);
    return newUser;
  }
}
