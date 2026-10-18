/** Auto-generated legal forms catalog — do not edit by hand. */
import { readFileSync } from 'fs';
import { join } from 'path';
import type { JurisdictionFormSeed } from './legal-forms.types';

export const JURISDICTION_FORMS_CATALOG_VERSION = '20260627';
export const JURISDICTION_FORMS_CATALOG_COUNT = 11253;

function loadCatalog(): JurisdictionFormSeed[] {
  const file = join(__dirname, 'catalog.data.json');
  return JSON.parse(readFileSync(file, 'utf8')) as JurisdictionFormSeed[];
}

export const CATALOG_GENERATED: JurisdictionFormSeed[] = loadCatalog();
