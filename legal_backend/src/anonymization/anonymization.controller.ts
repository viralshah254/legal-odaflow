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
import { AnonymizationService } from './anonymization.service';
import {
  CreateAnonymizationJobDto,
  UpdateAnonymizationJobDto,
} from './dto/anonymization.dto';

@Controller('anonymization')
export class AnonymizationController {
  constructor(private readonly anonymizationService: AnonymizationService) {}

  @Get()
  findAll(@Query('status') status?: string) {
    return this.anonymizationService.findAll(status);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.anonymizationService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateAnonymizationJobDto) {
    return this.anonymizationService.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateAnonymizationJobDto) {
    return this.anonymizationService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.anonymizationService.remove(id);
  }
}
