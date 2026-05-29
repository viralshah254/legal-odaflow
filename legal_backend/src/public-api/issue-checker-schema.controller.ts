import { Controller, Get } from '@nestjs/common';
import { Public } from '@/common/decorators/public.decorator';

/**
 * OpenAPI-style schema stub for ChatGPT Custom GPT / connector integrations.
 */
@Controller('public/issue-checker')
export class IssueCheckerSchemaController {
  @Public()
  @Get('schema')
  getSchema() {
    return {
      openapi: '3.1.0',
      info: {
        title: 'Legal by OdaFlow Issue Checker',
        version: '1.0.0',
        description:
          'Public schema for Custom GPT actions: classify a legal issue, generate a teaser, or request a full preview.',
      },
      servers: [{ url: '/api/v1' }],
      paths: {
        '/consumers/issue-checker/classify': {
          post: {
            operationId: 'classifyIssue',
            summary: 'Classify issue type and jurisdiction hints',
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/IssueCheckerClassify' },
                },
              },
            },
            responses: {
              '200': {
                description: 'Classification result',
                content: {
                  'application/json': {
                    schema: { $ref: '#/components/schemas/IssueCheckerClassifyResult' },
                  },
                },
              },
            },
          },
        },
        '/consumers/issue-checker/teaser': {
          post: {
            operationId: 'teaserIssue',
            summary: 'Anonymous teaser preview (no auth)',
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/IssueCheckerPreview' },
                },
              },
            },
            responses: { '200': { description: 'Teaser markdown and session id' } },
          },
        },
        '/consumers/issue-checker/preview': {
          post: {
            operationId: 'previewIssue',
            summary: 'Full AI preview (auth required for persisted case)',
            security: [{ bearerAuth: [] }],
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/IssueCheckerPreview' },
                },
              },
            },
            responses: { '200': { description: 'Preview report with citations' } },
          },
        },
      },
      components: {
        securitySchemes: {
          bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        },
        schemas: {
          IssueCheckerClassify: {
            type: 'object',
            required: ['countryCode', 'facts'],
            properties: {
              countryCode: { type: 'string', enum: ['IN', 'US', 'KE', 'GB'] },
              facts: { type: 'string', minLength: 20 },
              jurisdiction: { type: 'string' },
              mode: { type: 'string', enum: ['SELF', 'FIRM_INTAKE'] },
            },
          },
          IssueCheckerClassifyResult: {
            type: 'object',
            properties: {
              issueType: { type: 'string' },
              title: { type: 'string' },
              suggestedJurisdiction: { type: 'string' },
              riskLevel: { type: 'string' },
            },
          },
          IssueCheckerPreview: {
            type: 'object',
            required: ['countryCode', 'issueType', 'title'],
            properties: {
              countryCode: { type: 'string' },
              issueType: { type: 'string' },
              title: { type: 'string' },
              facts: { type: 'string' },
              desiredOutcome: { type: 'string' },
              jurisdiction: { type: 'string' },
              urgencyLevel: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] },
              anonymousSessionId: { type: 'string' },
            },
          },
        },
      },
    };
  }
}
