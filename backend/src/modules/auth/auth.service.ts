import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { Repository } from 'typeorm';
import { AccountStatus, User } from '../users/entities/user.entity';
import { LoginDto, RegisterDto } from './dto/auth.dto';

export type JwtPayload = { sub: string; email: string };

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    private jwtService: JwtService,
  ) {}

  async register({ email, password, fullName }: RegisterDto) {
    const normalizedEmail = email.trim().toLowerCase();
    if (await this.usersRepository.existsBy({ email: normalizedEmail })) {
      throw new ConflictException('Email đã được sử dụng');
    }

    const user = await this.usersRepository.save(
      this.usersRepository.create({
        email: normalizedEmail,
        fullName: fullName.trim(),
        passwordHash: await bcrypt.hash(password, 10),
      }),
    );
    return this.buildSession(user);
  }

  async login({ email, password }: LoginDto) {
    const user = await this.usersRepository.findOneBy({ email: email.trim().toLowerCase() });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
    }
    if (user.accountStatus === AccountStatus.BANNED) {
      throw new UnauthorizedException('Tài khoản của bạn đã bị khóa');
    }
    return this.buildSession(user);
  }

  async findUser(id: string) {
    const user = await this.usersRepository.findOneBy({ id });
    if (!user) {
      throw new UnauthorizedException('Người dùng không tồn tại');
    }
    return toPublicUser(user);
  }

  private async buildSession(user: User) {
    const payload: JwtPayload = { sub: user.id, email: user.email };
    return {
      accessToken: await this.jwtService.signAsync(payload),
      user: toPublicUser(user),
    };
  }
}

function toPublicUser(user: User) {
  return { id: user.id, email: user.email, fullName: user.fullName, role: user.role };
}
