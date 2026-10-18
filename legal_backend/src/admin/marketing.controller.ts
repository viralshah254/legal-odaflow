import { Body, Controller, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Public } from '@/common/decorators/public.decorator';
import { DemoRequestsService } from './demo-requests.service';
import { CreateDemoRequestDto } from './dto/create-demo-request.dto';

@Controller('marketing')
export class MarketingController {
  constructor(private readonly demoRequestsService: DemoRequestsService) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 3600000 } })
  @Post('demo-requests')
  createDemoRequest(@Body() dto: CreateDemoRequestDto) {
    return this.demoRequestsService.create(dto);
  }
}
