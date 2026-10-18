/**
 * TODO-080, TODO-081, TODO-082 — Contract Management Service
 *
 * CRUD for ContractEntity, ContractClauseV2, ContractObligation,
 * ContractApproval, and obligation due-date tracking.
 */

import { Injectable, Logger } from '@nestjs/common';
import type {
  ContractEntity,
  ContractApproval,
  ContractObligation,
} from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { DomainError, DomainErrorCode } from '@/common/errors/domain-errors';

// ─── DTOs ─────────────────────────────────────────────────────────────────────

export interface CreateContractDto {
  matterId?: string;
  documentId?: string;
  reviewWorkspaceId?: string;
  contractType: string;
  title: string;
  parties: Array<{ name: string; role: string; entityType?: string }>;
  effectiveDate?: Date | string;
  expiryDate?: Date | string;
  autoRenewal?: boolean;
  governingLaw?: string;
  jurisdiction?: string;
  negotiationStatus?: string;
}

export interface ListContractsFilters {
  matterId?: string;
  contractType?: string;
  status?: string;
  skip?: number;
  take?: number;
}

export interface CreateApprovalDto {
  approvalType: string;
  requiredFrom: string[];
  notes?: string;
  dueDate?: Date | string;
}

@Injectable()
export class ContractManagementService {
  private readonly logger = new Logger(ContractManagementService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─── Contract CRUD ────────────────────────────────────────────────────────

  async createContract(
    tenantId: string,
    _userId: string,
    dto: CreateContractDto,
  ): Promise<ContractEntity> {
    const contract = await this.prisma.contractEntity.create({
      data: {
        tenantId,
        matterId: dto.matterId,
        documentId: dto.documentId,
        reviewWorkspaceId: dto.reviewWorkspaceId,
        contractType: dto.contractType,
        title: dto.title,
        parties: dto.parties as any,
        effectiveDate: dto.effectiveDate ? new Date(dto.effectiveDate) : null,
        expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : null,
        autoRenewal: dto.autoRenewal ?? false,
        governingLaw: dto.governingLaw,
        jurisdiction: dto.jurisdiction,
        negotiationStatus: dto.negotiationStatus ?? 'not_started',
        status: 'draft',
      },
      include: {
        clauses: true,
        obligations: true,
        approvals: true,
      },
    });

    this.logger.log(`Created contract ${contract.id} type=${dto.contractType} tenant=${tenantId}`);
    return contract;
  }

  async getContract(contractId: string, tenantId: string): Promise<ContractEntity> {
    const contract = await this.prisma.contractEntity.findFirst({
      where: { id: contractId, tenantId },
      include: {
        clauses: { orderBy: { createdAt: 'asc' } },
        obligations: { orderBy: { dueDate: 'asc' } },
        approvals: { orderBy: { createdAt: 'desc' } },
      },
    });

    if (!contract) {
      throw new DomainError(
        DomainErrorCode.NOT_FOUND,
        `Contract ${contractId} not found.`,
        404,
      );
    }

    return contract;
  }

  async listContracts(
    tenantId: string,
    filters: ListContractsFilters,
  ): Promise<ContractEntity[]> {
    return this.prisma.contractEntity.findMany({
      where: {
        tenantId,
        ...(filters.matterId ? { matterId: filters.matterId } : {}),
        ...(filters.contractType ? { contractType: filters.contractType } : {}),
        ...(filters.status ? { status: filters.status } : {}),
      },
      include: {
        clauses: { select: { id: true, clauseType: true, riskLevel: true } },
        obligations: { select: { id: true, obligationType: true, status: true, dueDate: true } },
        approvals: { select: { id: true, status: true, approvalType: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: filters.skip ?? 0,
      take: filters.take ?? 20,
    });
  }

  async updateStatus(
    contractId: string,
    tenantId: string,
    status: string,
  ): Promise<ContractEntity> {
    await this.assertContractExists(contractId, tenantId);

    const validStatuses = ['draft', 'active', 'expired', 'terminated', 'renewed', 'superseded'];
    if (!validStatuses.includes(status)) {
      throw new DomainError(
        DomainErrorCode.VALIDATION_FAILED,
        `Invalid contract status: ${status}. Must be one of: ${validStatuses.join(', ')}`,
        400,
      );
    }

    return this.prisma.contractEntity.update({
      where: { id: contractId },
      data: { status },
    });
  }

  // ─── TODO-081: Approval workflow ──────────────────────────────────────────

  async createApprovalWorkflow(
    contractId: string,
    tenantId: string,
    dto: CreateApprovalDto,
  ): Promise<ContractApproval> {
    await this.assertContractExists(contractId, tenantId);

    const approval = await this.prisma.contractApproval.create({
      data: {
        contractId,
        tenantId,
        approvalType: dto.approvalType,
        requiredFrom: dto.requiredFrom,
        approvedBy: [],
        status: 'pending',
        notes: dto.notes,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
      },
    });

    this.logger.log(`Created approval ${approval.id} for contract ${contractId}`);
    return approval;
  }

  async approveContract(
    approvalId: string,
    contractId: string,
    tenantId: string,
    userId: string,
    notes?: string,
  ): Promise<ContractApproval> {
    const approval = await this.assertApprovalExists(approvalId, contractId, tenantId);

    if (approval.status !== 'pending') {
      throw new DomainError(
        DomainErrorCode.CONFLICT,
        `Approval ${approvalId} is already ${approval.status}.`,
        409,
      );
    }

    if (!approval.requiredFrom.includes(userId) && !approval.requiredFrom.includes('*')) {
      throw new DomainError(
        DomainErrorCode.FORBIDDEN,
        'You are not authorized to approve this contract.',
        403,
      );
    }

    const newApprovedBy = Array.from(new Set([...approval.approvedBy, userId]));
    const allApproved = approval.requiredFrom.every(
      (r) => r === '*' || newApprovedBy.includes(r),
    );

    return this.prisma.contractApproval.update({
      where: { id: approvalId },
      data: {
        approvedBy: newApprovedBy,
        notes: notes ?? approval.notes,
        status: allApproved ? 'approved' : 'pending',
        completedAt: allApproved ? new Date() : null,
      },
    });
  }

  async rejectApproval(
    approvalId: string,
    contractId: string,
    tenantId: string,
    userId: string,
    notes: string,
  ): Promise<ContractApproval> {
    const approval = await this.assertApprovalExists(approvalId, contractId, tenantId);

    if (approval.status !== 'pending') {
      throw new DomainError(
        DomainErrorCode.CONFLICT,
        `Approval ${approvalId} is already ${approval.status}.`,
        409,
      );
    }

    return this.prisma.contractApproval.update({
      where: { id: approvalId },
      data: {
        status: 'rejected',
        notes,
        completedAt: new Date(),
      },
    });
  }

  // ─── TODO-082: Obligation due-date tracking ───────────────────────────────

  async getObligationsDueSoon(
    tenantId: string,
    daysAhead: number,
  ): Promise<ContractObligation[]> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + daysAhead);

    return this.prisma.contractObligation.findMany({
      where: {
        tenantId,
        status: 'active',
        dueDate: {
          gte: new Date(),
          lte: cutoff,
        },
      },
      orderBy: { dueDate: 'asc' },
    });
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private async assertContractExists(contractId: string, tenantId: string): Promise<void> {
    const exists = await this.prisma.contractEntity.findFirst({
      where: { id: contractId, tenantId },
      select: { id: true },
    });

    if (!exists) {
      throw new DomainError(
        DomainErrorCode.NOT_FOUND,
        `Contract ${contractId} not found.`,
        404,
      );
    }
  }

  private async assertApprovalExists(
    approvalId: string,
    contractId: string,
    tenantId: string,
  ): Promise<ContractApproval> {
    const approval = await this.prisma.contractApproval.findFirst({
      where: { id: approvalId, contractId, tenantId },
    });

    if (!approval) {
      throw new DomainError(
        DomainErrorCode.NOT_FOUND,
        `Approval ${approvalId} not found.`,
        404,
      );
    }

    return approval;
  }
}
