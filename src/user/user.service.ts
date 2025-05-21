import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  async findUserByAddress(address: string): Promise<User | null> {
    address = address.toLowerCase();
    return this.userRepository.findOne({ where: { address } });
  }

  async findUserById(id: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { id } });
  }

  async findOrCreateUser(address: string): Promise<User> {
    address = address.toLowerCase();

    // 查找现有用户
    let user = await this.findUserByAddress(address);

    // 如果用户不存在，创建新用户
    if (!user) {
      user = this.userRepository.create({
        address,
        isActive: true,
      });
      await this.userRepository.save(user);
    }

    return user;
  }
}
