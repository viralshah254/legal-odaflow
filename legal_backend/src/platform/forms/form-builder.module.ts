import { Module } from '@nestjs/common';
import { FormBuilderController } from './form-builder.controller';
import { FormBuilderService } from './form-builder.service';

@Module({
  controllers: [FormBuilderController],
  providers: [FormBuilderService],
  exports: [FormBuilderService],
})
export class FormBuilderModule {}
