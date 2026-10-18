import { Injectable } from '@nestjs/common';
import { LoggerService } from '@/common/observability/logger.service';

export interface ScanResult {
  clean: boolean;
  threats: string[];
  sanitized: string;
}

interface ThreatPattern {
  category: string;
  patterns: RegExp[];
}

const THREAT_PATTERNS: ThreatPattern[] = [
  {
    category: 'role_override',
    patterns: [
      /ignore\s+(all\s+)?previous\s+instructions?/gi,
      /you\s+are\s+now\s+/gi,
      /act\s+as\s+/gi,
      /pretend\s+to\s+be\s+/gi,
      /new\s+instructions?:/gi,
      /system\s+prompt:/gi,
    ],
  },
  {
    category: 'data_extraction',
    patterns: [
      /print\s+your\s+system\s+prompt/gi,
      /reveal\s+your\s+instructions?/gi,
      /show\s+all\s+data/gi,
      /return\s+all\s+user\s+data/gi,
    ],
  },
  {
    category: 'command_injection',
    patterns: [
      /`[^`]*`/g,
      /\$\([^)]*\)/g,
      /;\s*(?:rm|del|drop|exec|eval|cat|wget|curl)\s+/gi,
      /\|\s*(?:sh|bash|cmd|powershell)/gi,
    ],
  },
  {
    category: 'jailbreak',
    patterns: [
      /do\s+anything\s+now/gi,
      /\bDAN\s+mode\b/gi,
      /developer\s+mode/gi,
      /unlock\s+restrictions?/gi,
    ],
  },
];

@Injectable()
export class PromptInjectionGuard {
  constructor(private readonly logger: LoggerService) {}

  scan(input: string): ScanResult {
    const threats: string[] = [];
    let sanitized = input;

    for (const { category, patterns } of THREAT_PATTERNS) {
      for (const pattern of patterns) {
        pattern.lastIndex = 0;
        if (pattern.test(input)) {
          if (!threats.includes(category)) {
            threats.push(category);
          }
        }
      }
    }

    for (const { category, patterns } of THREAT_PATTERNS) {
      for (const pattern of patterns) {
        pattern.lastIndex = 0;
        sanitized = sanitized.replace(pattern, `[REMOVED:${category.toUpperCase()}]`);
      }
    }

    const clean = threats.length === 0;

    if (!clean) {
      this.logger.warn('prompt_injection_detected', {
        metadata: { threats, inputLength: input.length },
      });
    }

    return { clean, threats, sanitized };
  }
}
