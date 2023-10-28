import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Inject,
  Post,
  Query,
  UnauthorizedException,
} from '@nestjs/common';
import { AppService } from './app.service';
import { randomUUID } from 'crypto';
import * as qrcode from 'qrcode';
import { RedisService } from './redis/redis.service';
import { JwtService } from '@nestjs/jwt';

enum EStatus {
  '未扫描' = 'no-scan',
  '已扫码，等待用户确认' = 'scan-wait-confirm',
  '已扫码，用户同意授权' = 'scan-confirm',
  '已扫码，用户取消授权' = 'scan-cancel',
  '已过期' = 'expired',
}

// type QrCodeInfo = {
//   status: EStatus;
//   userInfo?: {
//     userId: number;
//   };
// };

@Controller()
export class AppController {
  private users = [
    { id: 1, username: 'dong', password: '111' },
    { id: 2, username: 'guang', password: '222' },
  ];
  constructor(private readonly appService: AppService) {}

  @Inject(RedisService)
  private readonly redisService: RedisService;

  @Inject(JwtService)
  private readonly jwtService: JwtService;

  @Get('/')
  hello() {
    return 'hello';
  }

  @Post('login')
  async login(
    @Body('username') username: string,
    @Body('password') password: string,
  ) {
    const user = this.users.find((item) => item.username === username);
    if (!user) throw new UnauthorizedException('用户不存在');
    if (user.password !== password) throw new UnauthorizedException('密码错误');
    return {
      token: this.jwtService.sign({
        userId: user.id,
      }),
    };
  }

  @Get('qrcode/generate')
  async generate() {
    const _uuid = randomUUID();
    const _dataUrl = await qrcode.toDataURL(
      `http://192.168.1.101:3000/pages/confirm.html?id=${_uuid}`,
    );
    this.redisService.hSet(
      `qrcode_${_uuid}`,
      {
        status: EStatus.未扫描,
      },
      5 * 60,
    );
    return {
      qrcode_id: _uuid,
      img: _dataUrl,
    };
  }

  @Get('qrcode/check')
  async check(
    @Query('id') id: `${string}-${string}-${string}-${string}-${string}`,
  ) {
    const _status = await this.redisService.hGet(`qrcode_${id}`, 'status');
    return { status: _status };
  }

  @Get('qrcode/scan')
  async scan(
    @Query('id') id: `${string}-${string}-${string}-${string}-${string}`,
  ) {
    const _status = await this.redisService.hGet(`qrcode_${id}`, 'status');
    if (!_status) throw new BadRequestException('二维码已过期');
    await this.redisService.hSet(`qrcode_${id}`, {
      status: EStatus['已扫码，等待用户确认'],
    });
    return new HttpException('success', HttpStatus.OK);
  }

  @Get('qrcode/confirm')
  async confirm(
    @Query('id') id: `${string}-${string}-${string}-${string}-${string}`,
  ) {
    const _status = await this.redisService.hGet(`qrcode_${id}`, 'status');
    if (!_status) throw new BadRequestException('二维码已过期');
    await this.redisService.hSet(`qrcode_${id}`, {
      status: EStatus['已扫码，用户同意授权'],
    });
    return new HttpException('success', HttpStatus.OK);
  }

  @Get('qrcode/cancel')
  async cancel(
    @Query('id') id: `${string}-${string}-${string}-${string}-${string}`,
  ) {
    const _status = await this.redisService.hGet(`qrcode_${id}`, 'status');
    if (!_status) throw new BadRequestException('二维码已过期');
    await this.redisService.hSet(`qrcode_${id}`, {
      status: EStatus['已扫码，用户取消授权'],
    });
    return new HttpException('success', HttpStatus.OK);
  }
}
