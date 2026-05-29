import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { RequestUser } from '@/common/types/request-user.interface';
import {
  CreateTrainingConsentDto,
  UpdateTrainingConsentDto,
} from './dto/training-consent.dto';
import { TrainingConsentService } from './training-consent.service';

@Controller('training-consent')
export class TrainingConsentController {
  constructor(private readonly trainingConsentService: TrainingConsentService) {}

  @Get()
  findAll(
    @Query('userId') userId?: string,
    @Query('tenantId') tenantId?: string,
    @Query('consentStatus') consentStatus?: string,
  ) {
    return this.trainingConsentService.findAll({ userId, tenantId, consentStatus });
  }

  @Get('me/current')
  getCurrentForUser(@CurrentUser() user: RequestUser) {
    return this.trainingConsentService.getOrCreateForUser(user.id, user.tenantId);
  }

  @Patch('me/current')
  updateCurrentForUser(
    @CurrentUser() user: RequestUser,
    @Body() dto: UpdateTrainingConsentDto,
  ) {
    return this.trainingConsentService.updateCurrentForUser(user.id, user.tenantId, dto);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.trainingConsentService.findOne(id);
  }

  @Post()
  create(
    @Body() dto: CreateTrainingConsentDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.trainingConsentService.create(
      {
        ...dto,
        userId: dto.userId ?? user.id,
        tenantId: dto.tenantId ?? user.tenantId,
      },
      user.id,
    );
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateTrainingConsentDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.trainingConsentService.update(id, dto, user.id);
  }

  @Post(':id/withdraw')
  withdraw(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.trainingConsentService.withdraw(id, user.id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.trainingConsentService.remove(id);
  }
}
