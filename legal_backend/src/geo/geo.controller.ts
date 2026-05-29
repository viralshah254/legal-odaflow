import { Controller, Get, Req } from '@nestjs/common';
import { Request } from 'express';
import { Public } from '@/common/decorators/public.decorator';
import { GeoService } from './geo.service';

@Controller('geo')
export class GeoController {
  constructor(private readonly geoService: GeoService) {}

  @Public()
  @Get('detect')
  detect(@Req() req: Request) {
    return this.geoService.detectFromRequest(req.headers);
  }
}
