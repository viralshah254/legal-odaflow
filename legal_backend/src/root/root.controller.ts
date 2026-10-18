import { Controller, Get } from '@nestjs/common';
import { Public } from '@/common/decorators/public.decorator';

@Controller()
export class RootController {
  @Public()
  @Get()
  getRoot() {
    return {
      status: 'ok',
      api: '/api/v1',
    };
  }
}
