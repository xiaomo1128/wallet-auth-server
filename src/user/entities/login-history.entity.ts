import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';

@Entity('login_history')
export class LoginHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ nullable: true, name: 'ip_address' })
  ipAddress?: string;

  @Column({ nullable: true, name: 'user_agent' })
  userAgent?: string;

  @Column({ default: true })
  success: boolean;

  @Column({ nullable: true, name: 'failure_reason' })
  failureReason?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
