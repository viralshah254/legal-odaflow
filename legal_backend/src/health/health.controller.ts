import { Controller, Get } from '@nestjs/common';
import { Public } from '@/common/decorators/public.decorator';
import { HealthService } from './health.service';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Public()
  @Get()
  getHealth() {
    return this.healthService.getAppHealth();
  }

  @Public()
  @Get('db')
  getDatabaseHealth() {
    return this.healthService.getDatabaseHealth();
  }

  @Public()
  @Get('redis')
  getRedisHealth() {
    return this.healthService.getRedisHealth();
  }

  @Public()
  @Get('ai')
  getAiHealth() {
    return this.healthService.getAiHealth();
  }
}
