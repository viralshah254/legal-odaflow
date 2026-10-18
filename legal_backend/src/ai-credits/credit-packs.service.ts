import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { getCountryConfig } from '@/config/countries';
import { CurrencyFxService } from '@/config/currency-fx.service';
import { listLocalizedCreditPacks } from './credit-packs';

export interface ResolvedCreditPack {
  packId: string;
  credits: number;
  label: string;
  description: string;
  countryCode: string;
  currency: string;
  amount: number;
}

@Injectable()
export class CreditPacksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly currencyFx: CurrencyFxService,
  ) {}

  async listCreditPacks(
    countryCode: string,
    userSegment = 'LAWYER_SOLO',
    billingPlan?: string | null,
  ): Promise<ResolvedCreditPack[]> {
    const country = getCountryConfig(countryCode);
    const rows = await this.prisma.creditPack.findMany({
      where: {
        countryCode: country.code,
        userSegment,
        enabled: true,
      },
      orderBy: { price: 'asc' },
    });

    if (rows.length > 0) {
      return rows.map((row) => ({
        packId: row.packId,
        credits: row.credits + row.bonusCredits,
        label: row.label ?? row.packId,
        description: row.description ?? '',
        countryCode: row.countryCode,
        currency: row.currency,
        amount: Number(row.price),
      }));
    }

    return listLocalizedCreditPacks(countryCode, this.currencyFx, billingPlan);
  }

  async getCreditPack(
    countryCode: string,
    packId: string,
    userSegment = 'LAWYER_SOLO',
    billingPlan?: string | null,
  ) {
    const packs = await this.listCreditPacks(countryCode, userSegment, billingPlan);
    const pack = packs.find((row) => row.packId === packId);
    if (!pack) {
      throw new Error(`Unknown credit pack: ${packId}`);
    }
    return pack;
  }

  async syncRatesFromEnv(countryCode: string, userSegment: string) {
    const hardcoded = await listLocalizedCreditPacks(countryCode, this.currencyFx);
    for (const pack of hardcoded) {
      await this.prisma.creditPack.upsert({
        where: {
          packId_countryCode_userSegment: {
            packId: pack.packId,
            countryCode: pack.countryCode,
            userSegment,
          },
        },
        create: {
          packId: pack.packId,
          countryCode: pack.countryCode,
          currency: pack.currency,
          credits: pack.credits,
          price: pack.amount,
          userSegment,
          label: pack.label,
          description: pack.description,
          enabled: true,
        },
        update: {
          credits: pack.credits,
          price: pack.amount,
          label: pack.label,
          description: pack.description,
          enabled: true,
        },
      });
    }
  }
}
