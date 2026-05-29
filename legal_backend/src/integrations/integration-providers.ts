export const INTEGRATION_PROVIDERS = [
  'google_calendar',
  'outlook_calendar',
  'gmail',
  'outlook_email',
  'zoom',
  'google_meet',
  'teams',
  'docusign',
  'quickbooks',
] as const;

export type IntegrationProvider = (typeof INTEGRATION_PROVIDERS)[number];

export function isIntegrationProvider(value: string): value is IntegrationProvider {
  return (INTEGRATION_PROVIDERS as readonly string[]).includes(value);
}
