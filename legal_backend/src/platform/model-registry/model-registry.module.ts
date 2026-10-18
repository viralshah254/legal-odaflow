import { Module } from '@nestjs/common';

/**
 * Provides the model registry catalogue (definitions and cost profiles).
 * A full ModelRegistryService will be added when selector/router logic is needed;
 * for now the module acts as the boundary for platform model metadata.
 */
@Module({
  providers: [],
  exports: [],
})
export class ModelRegistryModule {}
