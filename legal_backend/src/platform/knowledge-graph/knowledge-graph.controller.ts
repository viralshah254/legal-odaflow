import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { TenantGuard } from '@/common/guards/tenant.guard';
import { KnowledgeGraphService } from './knowledge-graph.service';

@Controller()
export class KnowledgeGraphController {
  constructor(private readonly kgService: KnowledgeGraphService) {}

  @Get('knowledge-graph/nodes/:canonicalId')
  @UseGuards(TenantGuard)
  getNode(@Param('canonicalId') canonicalId: string) {
    return this.kgService.findNode(canonicalId);
  }

  @Post('knowledge-graph/traverse')
  @UseGuards(TenantGuard)
  traverseGraph(@Body() body: { from: string; edgeTypes?: string[]; depth?: number }) {
    return this.kgService.traverseGraph(body.from, body.edgeTypes ?? [], body.depth ?? 2);
  }

  @Get('knowledge-graph/issues/:id/elements')
  @UseGuards(TenantGuard)
  getIssueElements(@Param('id') id: string) {
    return this.kgService.getIssueElements(id);
  }

  @Get('knowledge-graph/cases/:id/treatment')
  @UseGuards(TenantGuard)
  getCaseTreatment(@Param('id') id: string) {
    return this.kgService.getCaseTreatment(id);
  }

  @Get('knowledge-graph/search')
  @UseGuards(TenantGuard)
  searchNodes(
    @Query('q') q: string,
    @Query('nodeType') nodeType?: string,
    @Query('jurisdiction') jurisdiction?: string,
  ) {
    return this.kgService.searchNodes(q, nodeType, jurisdiction);
  }

  @Post('admin/knowledge-graph/nodes')
  @UseGuards(TenantGuard)
  addNode(@Body() body: Parameters<KnowledgeGraphService['addNode']>[0]) {
    return this.kgService.addNode(body);
  }

  @Post('admin/knowledge-graph/edges')
  @UseGuards(TenantGuard)
  addEdge(@Body() body: Parameters<KnowledgeGraphService['addEdge']>[0]) {
    return this.kgService.addEdge(body);
  }
}
