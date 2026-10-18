import type { JurisdictionProfile } from '@/config/jurisdiction-engine';

export type LegalLocationSource =
  | 'request'
  | 'matter'
  | 'profile'
  | 'tenant'
  | 'geo'
  | 'default';

export interface EffectiveLegalLocation {
  countryCode: string;
  jurisdiction?: string;
  legalLocation: string;
  source: LegalLocationSource;
  assumed: boolean;
  tier: JurisdictionProfile['tier'];
}

export interface ResolveLegalLocationInput {
  userId?: string;
  tenantId?: string;
  matterId?: string;
  requestCountryCode?: string | null;
  requestJurisdiction?: string | null;
  geoHintCountryCode?: string | null;
  geoHintJurisdiction?: string | null;
}

export interface UserProfileLocationSnapshot {
  userType: string;
  countryCode: string | null;
  jurisdiction: string | null;
  consumerProfile?: {
    countryCode: string;
    stateOrCounty: string | null;
  } | null;
  tenant?: {
    primaryCountry: string;
  } | null;
}
