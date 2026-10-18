import { Injectable, Logger } from '@nestjs/common';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { randomUUID } from 'crypto';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';

@Injectable()
export class AudioTranscodeService {
  private readonly logger = new Logger(AudioTranscodeService.name);

  constructor() {
    if (ffmpegPath) {
      ffmpeg.setFfmpegPath(ffmpegPath);
    }
  }

  /** Convert WebM (audio or video) to AAC in an M4A container for iOS playback. */
  async transcodeWebmToM4a(input: Buffer): Promise<Buffer> {
    if (!ffmpegPath) {
      throw new Error('ffmpeg-static binary is not available');
    }

    const dir = mkdtempSync(join(tmpdir(), 'meeting-playback-'));
    const inputPath = join(dir, `${randomUUID()}.webm`);
    const outputPath = join(dir, `${randomUUID()}.m4a`);
    writeFileSync(inputPath, input);

    try {
      await new Promise<void>((resolve, reject) => {
        ffmpeg(inputPath)
          .noVideo()
          .audioCodec('aac')
          .audioBitrate('128k')
          .format('ipod')
          .on('end', () => resolve())
          .on('error', (err) => {
            this.logger.error(`WebM → M4A transcode failed: ${err.message}`);
            reject(err);
          })
          .save(outputPath);
      });
      return readFileSync(outputPath);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }
}
