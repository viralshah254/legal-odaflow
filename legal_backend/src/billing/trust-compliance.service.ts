import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import {
  TRUST_COMPLIANCE_PACKS,
  getTrustCompliancePack,
  TrustCompliancePack,
  TrustComplianceRule,
} from '@/config/trust-compliance-rules';

export interface ComplianceCheckItem {
  ruleId: string;
  title: string;
  description: string;
  regulation: string;
  severity: string;
  checkType: string;
  status: 'PASS' | 'FAIL' | 'WARNING' | 'UNKNOWN';
  detail?: string;
  deadline?: string;
}

export interface ComplianceCheckResult {
  tenantId: string;
  countryCode: string;
  jurisdiction: string;
  accountingBody: string;
  regulationName: string;
  checkedAt: Date;
  overallStatus: 'COMPLIANT' | 'NON_COMPLIANT' | 'NEEDS_REVIEW';
  criticalFailures: number;
  highFailures: number;
  items: ComplianceCheckItem[];
  summary: string;
  keyRequirements: string[];
}

@Injectable()
export class TrustComplianceService {
  constructor(private readonly prisma: PrismaService) {}

  getAllPacks(): TrustCompliancePack[] {
    return TRUST_COMPLIANCE_PACKS;
  }

  getPack(countryCode: string): TrustCompliancePack | undefined {
    return getTrustCompliancePack(countryCode);
  }

  getRulesByCountry(countryCode: string): TrustComplianceRule[] {
    const pack = getTrustCompliancePack(countryCode);
    return pack?.rules ?? [];
  }

  async runComplianceCheck(
    tenantId: string,
    countryCode: string,
  ): Promise<ComplianceCheckResult> {
    const pack = getTrustCompliancePack(countryCode);
    if (!pack) {
      throw new Error(`No compliance pack found for country: ${countryCode}`);
    }

    const items: ComplianceCheckItem[] = [];

    // Fetch trust accounts for this tenant
    const trustAccounts = await this.prisma.trustAccount.findMany({
      where: { tenantId },
    });

    const accountIds = trustAccounts.map((a) => a.id);

    // Get last reconciliation across all tenant accounts
    const lastRecon = accountIds.length > 0
      ? await this.prisma.trustReconciliation.findFirst({
          where: { accountId: { in: accountIds } },
          orderBy: { createdAt: 'desc' },
        })
      : null;

    for (const rule of pack.rules) {
      const item: ComplianceCheckItem = {
        ruleId: rule.id,
        title: rule.title,
        description: rule.description,
        regulation: rule.regulation,
        severity: rule.severity,
        checkType: rule.checkType,
        status: 'UNKNOWN',
        deadline: rule.deadline,
      };

      if (rule.checkType === 'RECONCILIATION') {
        if (!lastRecon) {
          item.status = 'FAIL';
          item.detail = 'No reconciliation records found for this firm.';
        } else {
          const daysSinceRecon = Math.floor(
            (Date.now() - lastRecon.createdAt.getTime()) / 86_400_000,
          );
          const maxDays = countryCode === 'GB' ? 35 : 30;

          if (daysSinceRecon > maxDays) {
            item.status = 'FAIL';
            item.detail = `Last reconciliation was ${daysSinceRecon} days ago — exceeds ${maxDays}-day limit.`;
          } else if (daysSinceRecon > maxDays * 0.7) {
            item.status = 'WARNING';
            item.detail = `Last reconciliation was ${daysSinceRecon} days ago — approaching ${maxDays}-day deadline.`;
          } else {
            item.status = 'PASS';
            item.detail = `Last reconciliation: ${daysSinceRecon} days ago.`;
          }
        }
      } else if (rule.checkType === 'SEGREGATION') {
        if (trustAccounts.length === 0) {
          item.status = 'WARNING';
          item.detail = 'No trust/client accounts configured in the system.';
        } else {
          item.status = 'PASS';
          item.detail = `${trustAccounts.length} trust account(s) configured.`;
        }
      } else if (rule.checkType === 'RECORD_KEEPING') {
        const ledgerCount =
          accountIds.length > 0
            ? await this.prisma.trustLedgerEntry.count({
                where: { accountId: { in: accountIds } },
              })
            : 0;
        if (ledgerCount === 0) {
          item.status = 'WARNING';
          item.detail = 'No trust ledger entries found.';
        } else {
          item.status = 'PASS';
          item.detail = `${ledgerCount} trust ledger entries on record.`;
        }
      } else if (rule.checkType === 'DISBURSEMENT') {
        // Check for stale deposits older than 90 days
        const staleLedger =
          accountIds.length > 0
            ? await this.prisma.trustLedgerEntry.findFirst({
                where: {
                  accountId: { in: accountIds },
                  type: 'DEPOSIT',
                  createdAt: { lt: new Date(Date.now() - 90 * 86_400_000) },
                },
                orderBy: { createdAt: 'asc' },
              })
            : null;
        if (staleLedger) {
          item.status = 'WARNING';
          item.detail =
            'Possible stale client funds detected — review client money older than 90 days.';
        } else {
          item.status = 'PASS';
          item.detail = 'No stale client funds detected.';
        }
      } else if (rule.checkType === 'REPORTING') {
        // Cannot auto-check external reporting — flag for manual review
        item.status = 'UNKNOWN';
        item.detail =
          'Requires manual verification — check annual audit/filing status.';
      } else {
        item.status = 'UNKNOWN';
      }

      items.push(item);
    }

    const criticalFailures = items.filter(
      (i) => i.severity === 'CRITICAL' && i.status === 'FAIL',
    ).length;
    const highFailures = items.filter(
      (i) => i.severity === 'HIGH' && i.status === 'FAIL',
    ).length;

    let overallStatus: ComplianceCheckResult['overallStatus'];
    if (criticalFailures > 0) {
      overallStatus = 'NON_COMPLIANT';
    } else if (highFailures > 0 || items.some((i) => i.status === 'WARNING')) {
      overallStatus = 'NEEDS_REVIEW';
    } else {
      overallStatus = 'COMPLIANT';
    }

    const summary =
      criticalFailures > 0
        ? `${criticalFailures} critical rule(s) failing — immediate action required.`
        : highFailures > 0
          ? `${highFailures} high-priority issue(s) need attention.`
          : 'No critical issues detected. Review flagged warnings.';

    return {
      tenantId,
      countryCode: pack.countryCode,
      jurisdiction: pack.jurisdiction,
      accountingBody: pack.accountingBody,
      regulationName: pack.regulationName,
      checkedAt: new Date(),
      overallStatus,
      criticalFailures,
      highFailures,
      items,
      summary,
      keyRequirements: pack.keyRequirements,
    };
  }

  async getReconciliationStatus(tenantId: string) {
    const trustAccounts = await this.prisma.trustAccount.findMany({
      where: { tenantId },
      include: { entries: { select: { id: true } } },
    });

    const accountIds = trustAccounts.map((a) => a.id);

    const lastRecon =
      accountIds.length > 0
        ? await this.prisma.trustReconciliation.findFirst({
            where: { accountId: { in: accountIds } },
            orderBy: { createdAt: 'desc' },
          })
        : null;

    const totalBalance = trustAccounts.reduce(
      (sum, a) => sum + Number(a.balance ?? 0),
      0,
    );

    return {
      lastReconciliationDate: lastRecon?.createdAt ?? null,
      lastReconciliationStatus: lastRecon?.status ?? null,
      daysSinceLastReconciliation: lastRecon
        ? Math.floor(
            (Date.now() - lastRecon.createdAt.getTime()) / 86_400_000,
          )
        : null,
      trustAccountsCount: trustAccounts.length,
      totalClientFundsBalance: totalBalance,
      accounts: trustAccounts.map((a) => ({
        id: a.id,
        accountName: a.name,
        balance: a.balance,
        currency: a.currency,
        ledgerEntryCount: a.entries.length,
      })),
    };
  }
}
