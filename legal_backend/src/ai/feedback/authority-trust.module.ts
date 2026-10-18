import { Module } from '@nestjs/common';
import { PrismaModule } from '@/prisma/prisma.module';
import { AuthorityTrustService } from './authority-trust.service';

/**
 * Thin shared module so LegalSearch and DraftFeedback can both use
 * AuthorityTrustService without circular imports.
 */
@Module({
  imports: [PrismaModule],
  providers: [AuthorityTrustService],
  exports: [AuthorityTrustService],
})
export class AuthorityTrustModule {}
