import { Body, Controller, Get } from '@nestjs/common';
import { Public } from '@/common/decorators/public.decorator';
import { PublicApiService } from './public-api.service';

@Controller('public-api')
export class PublicApiController {
  constructor(private readonly publicApiService: PublicApiService) {}

  @Public()
  @Get('health')
  getHealth() {
    return this.publicApiService.getHealth();
  }
}
