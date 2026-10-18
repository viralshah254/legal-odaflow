import { buildUsSectionFinderEntry } from './us-entry.factory';
import type { SectionFinderEntry } from '@/legal-search/india-section-finder/section-finder.types';

function st(
  actId: string,
  actShort: string,
  actFull: string,
  section: string,
  title: string,
  summary: string,
  jurisdiction: string,
  extra?: import('./us-entry.factory').UsCuratedSectionExtra,
): SectionFinderEntry {
  return buildUsSectionFinderEntry({
    actId,
    actShort,
    actFull,
    section,
    title,
    changeSummary: summary,
    jurisdiction,
    trialCourtLabel: `${jurisdiction} state trial courts (subject to court assignment rules)`,
    ...extra,
  });
}

function stRow(
  actId: string,
  actShort: string,
  actFull: string,
  section: string,
  title: string,
  summary: string,
  jurisdiction: string,
  extra?: import('./us-entry.factory').UsCuratedSectionExtra,
): { actId: string; entry: SectionFinderEntry } {
  return {
    actId,
    entry: st(actId, actShort, actFull, section, title, summary, jurisdiction, extra),
  };
}

const STATE_ROWS = [
  // ── California Penal Code ─────────────────────────────────────────────────
  stRow('ca-penal-code', 'CA Penal Code', 'California Penal Code', '187', 'Murder', 'Unlawful killing of a human being with malice aforethought.', 'CA', { punishment: '25 years to life; death or life without parole in special circumstances.' }),
  stRow('ca-penal-code', 'CA Penal Code', 'California Penal Code', '192', 'Manslaughter', 'Voluntary, involuntary, and vehicular manslaughter.', 'CA'),
  stRow('ca-penal-code', 'CA Penal Code', 'California Penal Code', '211', 'Robbery', 'Felony taking of personal property from person or immediate presence by force or fear.', 'CA', { punishment: '2, 3, or 5 years state prison (first degree).' }),
  stRow('ca-penal-code', 'CA Penal Code', 'California Penal Code', '459', 'Burglary', 'Entry into structure with intent to commit theft or felony.', 'CA'),
  stRow('ca-penal-code', 'CA Penal Code', 'California Penal Code', '487', 'Grand theft', 'Theft exceeding statutory value threshold or involving certain property.', 'CA'),
  stRow('ca-penal-code', 'CA Penal Code', 'California Penal Code', '496', 'Receiving stolen property', 'Receiving property known to be stolen.', 'CA'),
  stRow('ca-penal-code', 'CA Penal Code', 'California Penal Code', '243', 'Battery', 'Willful and unlawful use of force or violence upon another.', 'CA'),
  stRow('ca-penal-code', 'CA Penal Code', 'California Penal Code', '273.5', 'Corporal injury on intimate partner', 'Domestic violence corporal injury misdemeanor/felony wobbler.', 'CA'),
  stRow('ca-penal-code', 'CA Penal Code', 'California Penal Code', '288', 'Lewd acts with child', 'Lewd or lascivious acts with child under 14.', 'CA'),
  stRow('ca-penal-code', 'CA Penal Code', 'California Penal Code', '261', 'Rape', 'Non-consensual sexual intercourse under defined circumstances.', 'CA'),
  // ── California Civil Code ─────────────────────────────────────────────────
  stRow('ca-civil-code', 'CA Civil Code', 'California Civil Code', '1714', 'Duty of care', 'General duty of care; everyone responsible for willful acts and negligent failure to act.', 'CA'),
  stRow('ca-civil-code', 'CA Civil Code', 'California Civil Code', '1941', 'Landlord obligation to repair', 'Landlord must maintain premises in habitable condition.', 'CA'),
  stRow('ca-civil-code', 'CA Civil Code', 'California Civil Code', '3294', 'Exemplary damages', 'Punitive damages when oppression, fraud, or malice proven by clear and convincing evidence.', 'CA'),
  // ── California Labor Code ─────────────────────────────────────────────────
  stRow('ca-labor-code', 'CA Labor Code', 'California Labor Code', '510', 'Day\'s work; overtime', 'California daily and weekly overtime requirements (stricter than FLSA).', 'CA', { practiceNote: 'Compare with FLSA exemptions — California has narrower exemption categories.' }),
  stRow('ca-labor-code', 'CA Labor Code', 'California Labor Code', '1194', 'Action to recover minimum wage or overtime', 'Private right of action for unpaid minimum wage and overtime.', 'CA'),
  stRow('ca-labor-code', 'CA Labor Code', 'California Labor Code', '2922', 'Employment at will', 'Employment without fixed term is at-will absent contrary agreement.', 'CA'),
  // ── New York Penal Law ────────────────────────────────────────────────────
  stRow('ny-penal-law', 'NY Penal Law', 'New York Penal Law', '125.25', 'Murder in the second degree', 'Intentional murder and felony murder under NY Penal Law.', 'NY', { punishment: '15 years to life imprisonment.' }),
  stRow('ny-penal-law', 'NY Penal Law', 'New York Penal Law', '125.27', 'Murder in the first degree', 'Aggravated intentional murder with special circumstances.', 'NY', { punishment: 'Life imprisonment or death (where applicable under NY law history).' }),
  stRow('ny-penal-law', 'NY Penal Law', 'New York Penal Law', '155.30', 'Grand larceny in the fourth degree', 'Theft exceeding $1,000 or involving certain property.', 'NY'),
  stRow('ny-penal-law', 'NY Penal Law', 'New York Penal Law', '155.35', 'Grand larceny in the third degree', 'Theft exceeding $3,000.', 'NY'),
  stRow('ny-penal-law', 'NY Penal Law', 'New York Penal Law', '140.20', 'Burglary in the third degree', 'Unlawful entry with intent to commit crime.', 'NY'),
  stRow('ny-penal-law', 'NY Penal Law', 'New York Penal Law', '120.00', 'Assault in the third degree', 'Physical injury caused with intent or recklessness.', 'NY'),
  stRow('ny-penal-law', 'NY Penal Law', 'New York Penal Law', '220.03', 'Criminal possession of controlled substance in the seventh degree', 'Basic controlled substance possession offense.', 'NY'),
  // ── NY CPLR ───────────────────────────────────────────────────────────────
  stRow('ny-civil-practice-law', 'NY CPLR', 'New York Civil Practice Law and Rules', '3012', 'Requirements for court papers', 'Pleading requirements including particularity for fraud.', 'NY'),
  stRow('ny-civil-practice-law', 'NY CPLR', 'New York Civil Practice Law and Rules', '3211', 'Motion to dismiss', 'Pre-answer and post-answer dismissal motions.', 'NY'),
  stRow('ny-civil-practice-law', 'NY CPLR', 'New York Civil Practice Law and Rules', '213', 'Limitations of actions', 'Statute of limitations for civil actions in New York.', 'NY'),
  // ── Texas Penal Code ──────────────────────────────────────────────────────
  stRow('tx-penal-code', 'TX Penal Code', 'Texas Penal Code', '19.02', 'Murder', 'Intentionally or knowingly causing death; felony murder.', 'TX', { punishment: 'First degree felony — 5 to 99 years or life.' }),
  stRow('tx-penal-code', 'TX Penal Code', 'Texas Penal Code', '19.03', 'Capital murder', 'Aggravated murder with listed circumstances.', 'TX', { punishment: 'Life without parole or death penalty.' }),
  stRow('tx-penal-code', 'TX Penal Code', 'Texas Penal Code', '31.03', 'Theft', 'Unlawful appropriation with intent to deprive.', 'TX'),
  stRow('tx-penal-code', 'TX Penal Code', 'Texas Penal Code', '30.02', 'Burglary', 'Entry into building or habitation without consent with intent to commit felony, theft, or assault.', 'TX'),
  stRow('tx-penal-code', 'TX Penal Code', 'Texas Penal Code', '22.01', 'Assault', 'Intentionally, knowingly, or recklessly causing bodily injury.', 'TX'),
  stRow('tx-penal-code', 'TX Penal Code', 'Texas Penal Code', '49.04', 'Driving while intoxicated', 'Operating motor vehicle in public place while intoxicated.', 'TX'),
  stRow('tx-penal-code', 'TX Penal Code', 'Texas Penal Code', '481.115', 'Possession of controlled substance', 'Penalty group controlled substance possession.', 'TX'),
  // ── Texas Civil Practice ──────────────────────────────────────────────────
  stRow('tx-civil-practice', 'TX CPRC', 'Texas Civil Practice and Remedies Code', '16.003', 'Two-year limitations period', 'Two-year statute of limitations for personal injury and certain tort claims.', 'TX'),
  stRow('tx-civil-practice', 'TX CPRC', 'Texas Civil Practice and Remedies Code', '74.351', 'Expert report in health care liability claim', 'Expert report requirement in medical malpractice suits.', 'TX'),
  // ── Florida (Title XLVI / general) ────────────────────────────────────────
  stRow('fl-statutes-title-xlvi', 'FL Crimes', 'Florida Statutes Title XLVI — Crimes', '782.04', 'Murder', 'Unlawful killing with premeditation or during enumerated felonies.', 'FL', { punishment: 'Life felony or death in first degree murder.' }),
  stRow('fl-statutes-title-xlvi', 'FL Crimes', 'Florida Statutes Title XLVI', '812.014', 'Theft', 'Grand theft and petit theft thresholds.', 'FL'),
  stRow('fl-statutes-title-xlvi', 'FL Crimes', 'Florida Statutes Title XLVI', '810.02', 'Burglary', 'Entering or remaining in structure or conveyance with intent to commit offense.', 'FL'),
  stRow('fl-statutes-title-xlvi', 'FL Crimes', 'Florida Statutes Title XLVI', '784.03', 'Battery', 'Intentional touch or strike against another without consent.', 'FL'),
  stRow('fl-statutes-title-xlvi', 'FL Crimes', 'Florida Statutes Title XLVI', '893.13', 'Possession of controlled substance', 'Possession and delivery of controlled substances.', 'FL'),
  // ── Illinois Criminal Code ────────────────────────────────────────────────
  stRow('il-criminal-code', 'IL Criminal Code', 'Illinois Criminal Code of 2012', '720 ILCS 5/9-1', 'First degree murder', 'Intentional killing with qualifying circumstances.', 'IL', { punishment: '20 to 60 years; extended term up to life.' }),
  stRow('il-criminal-code', 'IL Criminal Code', 'Illinois Criminal Code of 2012', '720 ILCS 5/16-1', 'Theft', 'General theft statute with value-based grading.', 'IL'),
  stRow('il-criminal-code', 'IL Criminal Code', 'Illinois Criminal Code of 2012', '720 ILCS 5/19-1', 'Burglary', 'Knowingly entering building or structure without authority with intent to commit felony or theft.', 'IL'),
  stRow('il-criminal-code', 'IL Criminal Code', 'Illinois Criminal Code of 2012', '720 ILCS 5/12-3', 'Battery', 'Knowingly without legal justification causing bodily harm or making insulting contact.', 'IL'),
  stRow('il-criminal-code', 'IL Criminal Code', 'Illinois Criminal Code of 2012', '720 ILCS 5/11-1.20', 'Criminal sexual assault', 'Sexual penetration by force or threat of force.', 'IL'),
  // ── Illinois Civil Procedure ────────────────────────────────────────────────
  stRow('il-civil-procedure', 'IL Civ Pro', 'Illinois Code of Civil Procedure', '735 ILCS 5/2-615', 'Motion to dismiss', '2-615 motion to dismiss for insufficient legal claim.', 'IL'),
  stRow('il-civil-procedure', 'IL Civ Pro', 'Illinois Code of Civil Procedure', '735 ILCS 5/13-202', 'General limitations', 'Two-year limitations for personal injury actions.', 'IL'),
];

export const US_STATE_CURATED: SectionFinderEntry[] = STATE_ROWS.map((row) => row.entry);
export const US_STATE_SEED_ACT_IDS: string[] = STATE_ROWS.map((row) => row.actId);
