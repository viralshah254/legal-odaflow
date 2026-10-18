export interface StateOverlay {
  code: string
  stateName: string
  apexCourt: string
  trialCourtTemplate: string
  civilCode: string
  civilRules: string
  criminalRules: string
  appellateRules: string
  familyStatute: string
  probateStatute: string
  landlordTenantStatute: string
  smallClaimsLimit: string
  proceduralNotes: string[]
  formReferences: Record<string, string>
  officialFormCatalog?: Record<string, string>
}
