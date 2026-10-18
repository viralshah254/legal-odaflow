import {
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { SkipTenant } from '@/common/decorators/skip-tenant.decorator';
import { RequestUser } from '@/common/types/request-user.interface';
import { UserDraftStyleService } from './user-draft-style.service';

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'text/plain',
  'text/markdown',
]);

@Controller('users/me/draft-style')
@SkipTenant()
export class UserDraftStyleController {
  constructor(private readonly service: UserDraftStyleService) {}

  /** GET /users/me/draft-style — current status, style summary, credit balance */
  @Get()
  getStyle(@CurrentUser() user: RequestUser) {
    return this.service.getStyle(user.id);
  }

  /** GET /users/me/draft-style/presets — list of Umbrella curated presets */
  @Get('presets')
  getPresets() {
    return this.service.getPresets();
  }

  /** POST /users/me/draft-style/samples — upload one sample document (free, max 4) */
  @Post('samples')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
      fileFilter: (_, file, cb) => {
        if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new Error('Unsupported file type. Upload PDF, DOCX, or TXT.'), false);
        }
      },
    }),
  )
  async uploadSample(
    @CurrentUser() user: RequestUser,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new Error('No file uploaded.');
    return this.service.uploadSample(
      user.id,
      file.buffer,
      file.mimetype,
      file.originalname,
    );
  }

  /** DELETE /users/me/draft-style/samples/:index — remove a sample by index */
  @Delete('samples/:index')
  removeSample(
    @CurrentUser() user: RequestUser,
    @Param('index', ParseIntPipe) index: number,
  ) {
    return this.service.removeSample(user.id, index);
  }

  /** POST /users/me/draft-style/analyze — charges 500 credits, extracts style */
  @Post('analyze')
  analyzeStyle(@CurrentUser() user: RequestUser) {
    return this.service.analyzeStyle(user.id);
  }

  /** DELETE /users/me/draft-style — full reset (free, no refund) */
  @Delete()
  resetStyle(@CurrentUser() user: RequestUser) {
    return this.service.resetStyle(user.id);
  }
}
