export interface CaseExemplar {
  title: string
  year: number
}

const EXEMPLARS_BY_COUNTRY: Record<string, CaseExemplar[]> = {
  KE: [
    { title: "Republic v. Ochieng", year: 2008 },
    { title: "Kenya Airways Ltd v. AG", year: 2015 },
    { title: "Mwangi v. Kenya Commercial Bank", year: 2012 },
    { title: "Okello v. Commissioner of Lands", year: 2019 },
    { title: "Wanjiku v. County Government of Nairobi", year: 2020 },
  ],
  IN: [
    { title: "Maneka Gandhi v. Union of India", year: 1978 },
    { title: "Kesavananda Bharati v. State of Kerala", year: 1973 },
    { title: "Vishaka v. State of Rajasthan", year: 1997 },
    { title: "Navtej Singh Johar v. Union of India", year: 2018 },
    { title: "Shreya Singhal v. Union of India", year: 2015 },
  ],
  US: [
    { title: "Brown v. Board of Education", year: 1954 },
    { title: "Miranda v. Arizona", year: 1966 },
    { title: "Roe v. Wade", year: 1973 },
    { title: "Citizens United v. FEC", year: 2010 },
    { title: "Obergefell v. Hodges", year: 2015 },
  ],
  GB: [
    { title: "Donoghue v. Stevenson", year: 1932 },
    { title: "R v. R", year: 1991 },
    { title: "R (Miller) v. Secretary of State", year: 2017 },
    { title: "Carlill v. Carbolic Smoke Ball Co.", year: 1893 },
    { title: "Caparo Industries v. Dickman", year: 1990 },
  ],
}

const GENERIC_EXEMPLARS: CaseExemplar[] = [
  { title: "Smith v. Jones", year: 2008 },
  { title: "State v. Williams", year: 2012 },
  { title: "In re Estate of Patel", year: 2016 },
  { title: "ABC Ltd v. XYZ Corp", year: 2019 },
  { title: "R v. Thompson", year: 2020 },
]

export function getCaseExemplars(countryCode: string): CaseExemplar[] {
  const upper = countryCode.toUpperCase()
  return EXEMPLARS_BY_COUNTRY[upper] ?? GENERIC_EXEMPLARS
}

export function buildJudgmentReviewLabels(countryCode: string): string[] {
  return getCaseExemplars(countryCode).map(
    (c) => `Reviewing judgment in ${c.title} (${c.year})`,
  )
}

export function buildCaseAnalysisLabels(countryCode: string): string[] {
  return getCaseExemplars(countryCode).map(
    (c) => `Analysing ${c.title} (${c.year})`,
  )
}
