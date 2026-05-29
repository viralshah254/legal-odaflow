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
import {
  CreateTrainingDatasetDto,
  CreateTrainingDatasetItemDto,
  UpdateTrainingDatasetDto,
  UpdateTrainingDatasetItemDto,
} from './dto/training-dataset.dto';
import { TrainingDatasetsService } from './training-datasets.service';

@Controller('training-datasets')
export class TrainingDatasetsController {
  constructor(private readonly trainingDatasetsService: TrainingDatasetsService) {}

  @Get()
  findAll(@Query('countryCode') countryCode?: string) {
    return this.trainingDatasetsService.findAllDatasets(countryCode);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.trainingDatasetsService.findDataset(id);
  }

  @Post()
  create(@Body() dto: CreateTrainingDatasetDto) {
    return this.trainingDatasetsService.createDataset(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateTrainingDatasetDto) {
    return this.trainingDatasetsService.updateDataset(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.trainingDatasetsService.removeDataset(id);
  }

  @Get(':id/items')
  findItems(@Param('id') id: string) {
    return this.trainingDatasetsService.findItems(id);
  }

  @Post('items')
  createItem(@Body() dto: CreateTrainingDatasetItemDto) {
    return this.trainingDatasetsService.createItem(dto);
  }

  @Patch('items/:itemId')
  updateItem(
    @Param('itemId') itemId: string,
    @Body() dto: UpdateTrainingDatasetItemDto,
  ) {
    return this.trainingDatasetsService.updateItem(itemId, dto);
  }

  @Delete('items/:itemId')
  removeItem(@Param('itemId') itemId: string) {
    return this.trainingDatasetsService.removeItem(itemId);
  }
}
