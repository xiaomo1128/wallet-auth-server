import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  address: string;

  @Column({ nullable: true })
  username?: string;

  @Column({ nullable: true })
  avatar?: string;

  @Column({ nullable: true })
  email?: string;

  @Column({ default: false, name: 'is_active' })
  isActive: boolean;

  @Column({ nullable: true, type: 'json' })
  metadata?: Record<string, any>;

  @Column({ default: 0, name: 'login_count' })
  loginCount: number;

  @Column({ nullable: true, name: 'last_login_at' })
  lastLoginAt?: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
