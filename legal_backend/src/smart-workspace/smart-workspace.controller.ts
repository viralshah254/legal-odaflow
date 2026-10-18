import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { TenantId } from '@/common/decorators/tenant-id.decorator';
import { TenantGuard } from '@/common/guards/tenant.guard';
import { RequestUser } from '@/common/types/request-user.interface';
import { SmartWorkspaceService } from './smart-workspace.service';
import { WorkspaceSearchService } from './workspace-search.service';
import { WorkspaceExportService } from './workspace-export.service';
import {
  AddDocumentDto,
  CreateAnnotationDto,
  CreateCanvasNodeDto,
  CreateLinkDto,
  CreateWorkspaceDto,
  ExtractToCanvasDto,
  UpdateAnnotationDto,
  UpdateCanvasNodeDto,
  UpdateLayoutDto,
  UpdatePaneStateDto,
} from './smart-workspace.dto';

@Controller()
@UseGuards(TenantGuard)
export class SmartWorkspaceController {
  constructor(
    private readonly service: SmartWorkspaceService,
    private readonly searchService: WorkspaceSearchService,
    private readonly exportService: WorkspaceExportService,
  ) {}

  // ── Matter-scoped entry-point ──────────────────────────────────────────────

  @Get('matters/:matterId/smart-workspace')
  getOrCreateForMatter(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('matterId') matterId: string,
  ) {
    return this.service.getOrCreateForMatter(tenantId, matterId, user.id);
  }

  @Get('matters/:matterId/smart-workspaces')
  listForMatter(
    @TenantId() tenantId: string,
    @Param('matterId') matterId: string,
  ) {
    return this.service.listForMatter(tenantId, matterId);
  }

  /** Evidence map endpoint (fixes the missing route used by evidence-map-view.tsx) */
  @Get('platform/matter-intelligence/evidence-map/:matterId')
  getEvidenceMap(
    @TenantId() tenantId: string,
    @Param('matterId') matterId: string,
  ) {
    return this.service.getEvidenceMap(tenantId, matterId);
  }

  // ── Workspace CRUD ─────────────────────────────────────────────────────────

  @Post('smart-workspaces')
  create(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateWorkspaceDto,
  ) {
    return this.service.create(tenantId, user.id, dto);
  }

  @Get('smart-workspaces/:id')
  findOne(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.service.findOne(tenantId, id);
  }

  @Patch('smart-workspaces/:id/layout')
  updateLayout(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateLayoutDto,
  ) {
    return this.service.updateLayout(tenantId, id, dto);
  }

  @Delete('smart-workspaces/:id')
  delete(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.service.delete(tenantId, id);
  }

  // ── Workspace documents ────────────────────────────────────────────────────

  @Post('smart-workspaces/:id/documents')
  addDocument(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() dto: AddDocumentDto,
  ) {
    return this.service.addDocument(tenantId, id, dto);
  }

  @Delete('smart-workspaces/:id/documents/:documentId')
  removeDocument(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Param('documentId') documentId: string,
  ) {
    return this.service.removeDocument(tenantId, id, documentId);
  }

  @Patch('smart-workspaces/:id/documents/:documentId/pane-state')
  updatePaneState(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Param('documentId') documentId: string,
    @Body() dto: UpdatePaneStateDto,
  ) {
    return this.service.updatePaneState(tenantId, id, documentId, dto);
  }

  // ── Annotations ────────────────────────────────────────────────────────────

  @Get('smart-workspaces/:id/annotations')
  listAnnotations(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Query('documentId') documentId?: string,
  ) {
    return this.service.listAnnotations(tenantId, id, documentId);
  }

  @Post('smart-workspaces/:id/annotations')
  createAnnotation(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: CreateAnnotationDto,
  ) {
    return this.service.createAnnotation(tenantId, id, user.id, dto);
  }

  @Patch('smart-workspaces/:id/annotations/:annotationId')
  updateAnnotation(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Param('annotationId') annotationId: string,
    @Body() dto: UpdateAnnotationDto,
  ) {
    return this.service.updateAnnotation(tenantId, id, annotationId, dto);
  }

  @Delete('smart-workspaces/:id/annotations/:annotationId')
  deleteAnnotation(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Param('annotationId') annotationId: string,
  ) {
    return this.service.deleteAnnotation(tenantId, id, annotationId);
  }

  // ── Links ──────────────────────────────────────────────────────────────────

  @Get('smart-workspaces/:id/links')
  listLinks(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.service.listLinks(tenantId, id);
  }

  @Post('smart-workspaces/:id/links')
  createLink(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() dto: CreateLinkDto,
  ) {
    return this.service.createLink(tenantId, id, dto);
  }

  @Delete('smart-workspaces/:id/links/:linkId')
  deleteLink(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Param('linkId') linkId: string,
  ) {
    return this.service.deleteLink(tenantId, id, linkId);
  }

  // ── Canvas nodes ───────────────────────────────────────────────────────────

  @Get('smart-workspaces/:id/canvas-nodes')
  listCanvasNodes(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.service.listCanvasNodes(tenantId, id);
  }

  @Post('smart-workspaces/:id/canvas-nodes')
  createCanvasNode(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: CreateCanvasNodeDto,
  ) {
    return this.service.createCanvasNode(tenantId, id, user.id, dto);
  }

  @Patch('smart-workspaces/:id/canvas-nodes/:nodeId')
  updateCanvasNode(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Param('nodeId') nodeId: string,
    @Body() dto: UpdateCanvasNodeDto,
  ) {
    return this.service.updateCanvasNode(tenantId, id, nodeId, dto);
  }

  @Delete('smart-workspaces/:id/canvas-nodes/:nodeId')
  deleteCanvasNode(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Param('nodeId') nodeId: string,
  ) {
    return this.service.deleteCanvasNode(tenantId, id, nodeId);
  }

  // ── Extract to canvas ──────────────────────────────────────────────────────

  @Post('smart-workspaces/:id/extract-to-canvas')
  extractToCanvas(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: ExtractToCanvasDto,
  ) {
    return this.service.extractToCanvas(tenantId, id, user.id, dto);
  }

  // ── Cross-doc search ───────────────────────────────────────────────────────

  @Get('smart-workspaces/:id/search')
  search(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Query('q') query: string,
    @Query('limit') limit?: string,
  ) {
    return this.searchService.search(tenantId, id, query ?? '', limit ? Number(limit) : 20);
  }

  // ── Export ─────────────────────────────────────────────────────────────────

  @Get('smart-workspaces/:id/export')
  async exportMarkdown(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const markdown = await this.exportService.exportMarkdown(tenantId, id);
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="workspace-${id}.md"`);
    res.send(markdown);
  }
}
