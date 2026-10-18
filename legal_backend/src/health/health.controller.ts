import { Controller, Get, UseGuards } from '@nestjs/common';
import { Public } from '@/common/decorators/public.decorator';
import { HealthDetailGuard } from './health-detail.guard';
import { HealthService } from './health.service';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Public()
  @Get()
  getHealth() {
    return this.healthService.getPublicHealth();
  }

  @Public()
  @Get('version')
  getVersion() {
    return this.healthService.getVersionInfo();
  }

  @Public()
  @UseGuards(HealthDetailGuard)
  @Get('db')
  getDatabaseHealth() {
    return this.healthService.getDatabaseHealth();
  }

  @Public()
  @Get('readiness')
  getReadiness() {
    return this.healthService.getPublicReadiness();
  }

  @Public()
  @UseGuards(HealthDetailGuard)
  @Get('redis')
  getRedisHealth() {
    return this.healthService.getRedisHealth();
  }

  @Public()
  @UseGuards(HealthDetailGuard)
  @Get('research-readiness')
  getResearchReadiness() {
    return this.healthService.getResearchReadiness();
  }

  @Public()
  @UseGuards(HealthDetailGuard)
  @Get('ai')
  getAiHealth() {
    return this.healthService.getAiHealth();
  }
}
