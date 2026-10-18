import { Module } from '@nestjs/common';
import { LegalLocationModule } from '@/legal-location/legal-location.module';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [LegalLocationModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
