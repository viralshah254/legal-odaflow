export interface StatuteSectionSeed {
  actId: string;
  countryCode: string;
  section: string;
  title: string;
  summary: string;
  fullText: string;
  sourceName: string;
  sourceUrl?: string;
  practiceAreas: string[];
  topics: string[];
}

export const PRIORITY_STATUTE_SECTIONS: StatuteSectionSeed[] = [
  // ── BNSS 2023 ──────────────────────────────────────────────────────────────
  {
    actId: 'bnss',
    countryCode: 'IN',
    section: '100',
    title: 'Search for persons wrongfully confined',
    summary:
      'When a Magistrate of the first class, Sub-divisional Magistrate or District Magistrate receives information on oath that a person is wrongfully confined, they may issue a search warrant and order restoration to liberty. Replaces CrPC section 97.',
    fullText:
      'Section 100 BNSS 2023 — Search for persons wrongfully confined. If any Magistrate of the first class, Sub-divisional Magistrate or District Magistrate has reason to believe that any person is confined under such circumstances that the confinement amounts to an offence, he may issue a search-warrant and cause the person to be searched for and, if found, to be set at liberty.',
    sourceName: 'India Code / BNSS 2023',
    sourceUrl: 'https://prsindia.org/files/bills_acts/bills_parliament/2023/Bharatiya_Nagarik_Suraksha_Sanhita,_2023.pdf',
    practiceAreas: ['criminal_procedure'],
    topics: ['bnss', 'section-100', 'wrongful-confinement', 'crpc-97'],
  },
  {
    actId: 'bnss',
    countryCode: 'IN',
    section: '101',
    title: 'Power to compel restoration of abducted females',
    summary:
      'Upon complaint on oath of abduction or unlawful detention of a woman, or a female child under eighteen, a District Magistrate, Sub-divisional Magistrate or Magistrate of the first class may order immediate restoration to liberty or lawful custody and compel compliance.',
    fullText:
      'Section 101 BNSS 2023 — Power to compel restoration of abducted females. Upon complaint made on oath of the abduction or unlawful detention of a woman, or a female child under the age of eighteen years for any unlawful purpose, a District Magistrate, Sub-divisional Magistrate or Magistrate of the first class may make an order for the immediate restoration of such woman to her liberty, or of such female child to her husband, parent, guardian or other person having the lawful charge of such child, and may compel compliance with such order, using such force as may be necessary.',
    sourceName: 'PRS India / BNSS 2023',
    sourceUrl: 'https://prsindia.org/files/bills_acts/bills_parliament/2023/Bharatiya_Nagarik_Suraksha_Sanhita,_2023.pdf',
    practiceAreas: ['criminal_procedure'],
    topics: ['bnss', 'bharatiya-nagarik-suraksha-sanhita', 'section-101', 'crpc'],
  },
  {
    actId: 'bnss',
    countryCode: 'IN',
    section: '144',
    title: 'Order for maintenance of wives, children and parents',
    summary:
      'Magistrate may order monthly maintenance for wives unable to maintain themselves, legitimate or illegitimate minor children, and parents unable to maintain themselves. Replaces CrPC section 125.',
    fullText:
      'Section 144 BNSS 2023 — Order for maintenance of wives, children and parents. If any person having sufficient means neglects or refuses to maintain his wife, unable to maintain herself, or his legitimate or illegitimate minor child, or his father or mother unable to maintain themselves, a Magistrate may order monthly allowance for maintenance.',
    sourceName: 'India Code / BNSS 2023',
    practiceAreas: ['criminal_procedure', 'family'],
    topics: ['bnss', 'section-144', 'maintenance', 'crpc-125'],
  },
  {
    actId: 'bnss',
    countryCode: 'IN',
    section: '173',
    title: 'Information in cognizable cases (First Information Report)',
    summary:
      'Every information relating to the commission of a cognizable offence given orally or in writing to an officer in charge of a police station shall be reduced to writing and registered as FIR. Replaces CrPC section 154.',
    fullText:
      'Section 173 BNSS 2023 — Information in cognizable cases. Every information relating to the commission of a cognizable offence, if given orally to an officer in charge of a police station, shall be reduced to writing and read over to the informant; every such information shall be signed and entered in a book kept as the First Information Report.',
    sourceName: 'India Code / BNSS 2023',
    practiceAreas: ['criminal_procedure'],
    topics: ['bnss', 'section-173', 'fir', 'crpc-154'],
  },
  {
    actId: 'bnss',
    countryCode: 'IN',
    section: '480',
    title: 'Bail in non-bailable offences',
    summary:
      'When a person accused of a non-bailable offence is arrested, he may be released on bail by the Court if he is under sixteen, a woman, sick or infirm, or if the Court sees sufficient cause. Replaces CrPC section 437.',
    fullText:
      'Section 480 BNSS 2023 — When bail may be taken in case of non-bailable offence. When any person accused of a non-bailable offence is arrested or detained without warrant, he may be released on bail if he is under sixteen years of age, a woman, sick or infirm, or if the Court is satisfied that there are sufficient grounds for granting bail.',
    sourceName: 'India Code / BNSS 2023',
    practiceAreas: ['criminal_procedure'],
    topics: ['bnss', 'section-480', 'bail', 'crpc-437'],
  },
  {
    actId: 'bnss',
    countryCode: 'IN',
    section: '481',
    title: 'Bail in bailable offences',
    summary:
      'When a person accused of, or suspected of committing, a bailable offence is arrested or detained without warrant, he shall be released on bail. Replaces CrPC section 436.',
    fullText:
      'Section 481 BNSS 2023 — When bail may be taken in case of bailable offence. When any person other than a person accused of a non-bailable offence is arrested or detained without warrant by an officer in charge of a police station, or appears or is brought before a Court, and is prepared at any time while in the custody of such officer or at any stage of the proceeding before such Court to give bail, such person shall be released on bail. Replaces CrPC section 436.',
    sourceName: 'India Code / BNSS 2023',
    practiceAreas: ['criminal_procedure'],
    topics: ['bnss', 'section-481', 'bail', 'bailable-offence', 'crpc-436'],
  },
  {
    actId: 'bnss',
    countryCode: 'IN',
    section: '482',
    title: 'Anticipatory bail',
    summary:
      'When a person has reason to believe he may be arrested on accusation of a non-bailable offence, he may apply to the High Court or Court of Session for bail in anticipation of arrest. Replaces CrPC section 438.',
    fullText:
      'Section 482 BNSS 2023 — Direction for grant of bail to person apprehending arrest. Where any person has reason to believe that he may be arrested on an accusation of having committed a non-bailable offence, he may apply to the High Court or Court of Session for a direction that in the event of such arrest he shall be released on bail.',
    sourceName: 'India Code / BNSS 2023',
    practiceAreas: ['criminal_procedure'],
    topics: ['bnss', 'section-482', 'anticipatory-bail', 'crpc-438'],
  },
  {
    actId: 'bnss',
    countryCode: 'IN',
    section: '483',
    title: 'Special powers of High Court and Court of Session regarding bail',
    summary:
      'The High Court or Court of Session may direct that any person be admitted to bail, or that bail required by a police officer or Magistrate be reduced. This is the primary provision for regular bail before Sessions Court or High Court after Magistrate refusal. Replaces CrPC section 439.',
    fullText:
      'Section 483 BNSS 2023 — Special powers of High Court or Court of Session regarding bail. (1) A High Court or Court of Session may direct — (a) that any person accused of an offence and in custody be admitted to bail, and in the case of a non-bailable offence impose any condition which it considers necessary for the purposes mentioned in that behalf in section 480; (b) that any condition imposed by a Magistrate when releasing any person on bail be set aside or modified; (c) that any person who has been released on bail under this Chapter be arrested and committed to custody. (2) A High Court or Court of Session, having cognizance of the matter, shall be the relevant court for the exercise of these powers where a Sessions Court or High Court is the Trial Court.',
    sourceName: 'India Code / BNSS 2023',
    practiceAreas: ['criminal_procedure'],
    topics: ['bnss', 'section-483', 'bail', 'sessions-court', 'high-court', 'special-powers', 'crpc-439', 'post-rejection-bail', 'regular-bail'],
  },
  // ── BNS 2023 ───────────────────────────────────────────────────────────────
  {
    actId: 'bns',
    countryCode: 'IN',
    section: '101',
    title: 'Murder',
    summary:
      'Whoever commits murder shall be punished with death or imprisonment for life, and shall also be liable to fine. Replaces IPC section 302.',
    fullText:
      'Section 101 BNS 2023 — Murder. Whoever commits murder shall be punished with death or imprisonment for life, and shall also be liable to fine. Murder is defined as culpable homicide with certain specified intentions or knowledge.',
    sourceName: 'India Code / BNS 2023',
    practiceAreas: ['criminal'],
    topics: ['bns', 'section-101', 'murder', 'ipc-302'],
  },
  {
    actId: 'bns',
    countryCode: 'IN',
    section: '63',
    title: 'Rape',
    summary:
      'Defines and punishes the offence of rape. Replaces IPC section 376.',
    fullText:
      'Section 63 BNS 2023 — Rape. A man is said to commit rape if he has sexual intercourse with a woman under circumstances falling within specified clauses including against her will, without her consent, or when she is below eighteen years of age.',
    sourceName: 'India Code / BNS 2023',
    practiceAreas: ['criminal'],
    topics: ['bns', 'section-63', 'rape', 'ipc-376'],
  },
  {
    actId: 'bns',
    countryCode: 'IN',
    section: '318',
    title: 'Cheating and dishonestly inducing delivery of property',
    summary:
      'Whoever cheats and thereby dishonestly induces the person deceived to deliver any property. Replaces IPC section 420.',
    fullText:
      'Section 318 BNS 2023 — Cheating and dishonestly inducing delivery of property. Whoever cheats and thereby dishonestly induces the person deceived to deliver any property to any person, or to make, alter or destroy any valuable security, shall be punished with imprisonment and fine.',
    sourceName: 'India Code / BNS 2023',
    practiceAreas: ['criminal', 'commercial'],
    topics: ['bns', 'section-318', 'cheating', 'ipc-420'],
  },
  // ── BSA 2023 ───────────────────────────────────────────────────────────────
  {
    actId: 'bsa',
    countryCode: 'IN',
    section: '63',
    title: 'Admissibility of electronic records',
    summary:
      'Special provisions as to evidence relating to electronic records including certificate requirements for admissibility. Replaces IEA section 65B.',
    fullText:
      'Section 63 BSA 2023 — Admissibility of electronic records. Any information contained in an electronic record which is printed on paper or stored or recorded or copied in optical or magnetic media shall be deemed to be a document if the conditions regarding computer output and certificate are satisfied.',
    sourceName: 'India Code / BSA 2023',
    practiceAreas: ['evidence'],
    topics: ['bsa', 'section-63', 'electronic-evidence', 'iea-65b'],
  },
  // ── Constitution of India (COI 2024 priority articles) ─────────────────────
  {
    actId: 'constitution',
    countryCode: 'IN',
    section: '21',
    title: 'Protection of life and personal liberty',
    summary:
      'No person shall be deprived of his life or personal liberty except according to procedure established by law.',
    fullText:
      'Article 21 — Protection of life and personal liberty. No person shall be deprived of his life or personal liberty except according to procedure established by law.',
    sourceName: 'Legislative Department (COI 2024)',
    sourceUrl: 'https://lddashboard.legislative.gov.in/sites/default/files/coi/COI_2024.pdf',
    practiceAreas: ['constitutional'],
    topics: ['constitution', 'article-21', 'fundamental-rights'],
  },
  {
    actId: 'constitution',
    countryCode: 'IN',
    section: '330A',
    title: 'Reservation of seats for women in House of the People',
    summary:
      'Inserted by the 106th Amendment Act, 2023 (Nari Shakti Vandan Adhiniyam). One-third of total seats in Lok Sabha shall be reserved for women including those reserved for SCs and STs. Commenced 16 April 2026.',
    fullText:
      'Article 330A — Reservation of seats for women in the House of the People. Seats shall be reserved for women in the House of the People including those reserved for the Scheduled Castes and the Scheduled Tribes, to the extent of one-third including the number of seats reserved for women belonging to the Scheduled Castes and the Scheduled Tribes.',
    sourceName: 'Legislative Department (COI 2024)',
    sourceUrl: 'https://lddashboard.legislative.gov.in/sites/default/files/coi/COI_2024.pdf',
    practiceAreas: ['constitutional'],
    topics: ['constitution', 'article-330a', '106th-amendment', 'women-reservation'],
  },
  {
    actId: 'constitution',
    countryCode: 'IN',
    section: '332A',
    title: 'Reservation of seats for women in State Legislative Assemblies',
    summary:
      'Inserted by the 106th Amendment Act, 2023 (Nari Shakti Vandan Adhiniyam). One-third of total seats in every State Legislative Assembly shall be reserved for women. Commenced 16 April 2026.',
    fullText:
      'Article 332A — Reservation of seats for women in the Legislative Assemblies of States. Seats shall be reserved for women in the Legislative Assembly of every State including those reserved for the Scheduled Castes and the Scheduled Tribes, to the extent of one-third of the total number of seats in the Legislative Assembly of each State.',
    sourceName: 'Legislative Department (COI 2024)',
    sourceUrl: 'https://lddashboard.legislative.gov.in/sites/default/files/coi/COI_2024.pdf',
    practiceAreas: ['constitutional'],
    topics: ['constitution', 'article-332a', '106th-amendment', 'women-reservation', 'state-assembly'],
  },
  {
    actId: 'constitution',
    countryCode: 'IN',
    section: '334A',
    title: 'Duration of reservation for women and review',
    summary:
      'Inserted by the 106th Amendment Act, 2023. Reservation of seats for women under Articles 330A and 332A shall take effect after census and delimitation, and shall continue for fifteen years. Commenced 16 April 2026.',
    fullText:
      'Article 334A — Duration of reservation for women and review. Notwithstanding anything in Articles 330A and 332A, the reservation of seats for women under those articles shall come into effect after the first census taken after the commencement of the Constitution (One Hundred and Sixth Amendment) Act, 2023 is published, and delimitation is done on the basis of that census, and shall continue for a period of fifteen years from the date on which such reservation first takes effect.',
    sourceName: 'Legislative Department (COI 2024)',
    sourceUrl: 'https://lddashboard.legislative.gov.in/sites/default/files/coi/COI_2024.pdf',
    practiceAreas: ['constitutional'],
    topics: ['constitution', 'article-334a', '106th-amendment', 'women-reservation', 'delimitation'],
  },
  // ── Dowry Prohibition Act 1961 ─────────────────────────────────────────────
  {
    actId: 'dowry-prohibition',
    countryCode: 'IN',
    section: '2',
    title: 'Definition of "dowry"',
    summary:
      'Defines dowry as any property or valuable security given or agreed to be given in connection with the marriage, but excludes dower or mahr in Muslim personal law.',
    fullText:
      'Section 2 Dowry Prohibition Act 1961 — Definition of "dowry". "Dowry" means any property or valuable security given or agreed to be given either directly or indirectly by one party to a marriage to the other party, or by the parents of either party, in connection with the marriage, but does not include dower or mahr in the case of persons to whom the Muslim Personal Law (Shariat) applies.',
    sourceName: 'India Code / Dowry Prohibition Act 1961',
    sourceUrl: 'https://www.indiacode.nic.in',
    practiceAreas: ['family', 'criminal'],
    topics: ['dowry-prohibition', 'section-2', 'dowry-definition'],
  },
  {
    actId: 'dowry-prohibition',
    countryCode: 'IN',
    section: '3',
    title: 'Penalty for giving or taking dowry',
    summary:
      'Punishes giving or taking dowry with imprisonment up to five years and fine not less than fifteen thousand rupees or the amount of dowry, whichever is more.',
    fullText:
      'Section 3 Dowry Prohibition Act 1961 — Penalty for giving or taking dowry. If any person gives or takes or abets the giving or taking of dowry, he shall be punishable with imprisonment for a term which shall not be less than five years, and with fine which shall not be less than fifteen thousand rupees or the amount of the value of such dowry, whichever is more.',
    sourceName: 'India Code / Dowry Prohibition Act 1961',
    practiceAreas: ['family', 'criminal'],
    topics: ['dowry-prohibition', 'section-3', 'penalty'],
  },
  {
    actId: 'dowry-prohibition',
    countryCode: 'IN',
    section: '4',
    title: 'Penalty for demanding dowry',
    summary:
      'Punishes demand for dowry from parents or relatives of the bride or bridegroom with imprisonment up to two years and fine up to ten thousand rupees.',
    fullText:
      'Section 4 Dowry Prohibition Act 1961 — Penalty for demanding dowry. If any person demands, directly or indirectly, from the parents or other relatives or guardian of a bride or bridegroom, as the case may be, any dowry, he shall be punishable with imprisonment for a term which may extend to two years and with fine which may extend to ten thousand rupees.',
    sourceName: 'India Code / Dowry Prohibition Act 1961',
    practiceAreas: ['family', 'criminal'],
    topics: ['dowry-prohibition', 'section-4', 'demand'],
  },
  // ── Domestic Violence Act 2005 ───────────────────────────────────────────────
  {
    actId: 'domestic-violence',
    countryCode: 'IN',
    section: '3',
    title: 'Definition of domestic violence',
    summary:
      'Defines domestic violence to include physical, sexual, verbal, emotional and economic abuse, harassment for dowry, and acts injurious to health, safety or dignity.',
    fullText:
      'Section 3 Protection of Women from Domestic Violence Act 2005 — Definition of domestic violence. For the purposes of this Act, any act, omission or commission or conduct of the respondent shall constitute domestic violence if it harms or injures or endangers the health, safety, life, limb or well-being of the aggrieved person or tends to do so and includes physical, sexual, verbal and emotional abuse and economic abuse.',
    sourceName: 'India Code / Domestic Violence Act 2005',
    practiceAreas: ['family'],
    topics: ['domestic-violence', 'pwdva', 'section-3', 'definition'],
  },
  {
    actId: 'domestic-violence',
    countryCode: 'IN',
    section: '12',
    title: 'Application to Magistrate',
    summary:
      'An aggrieved person or Protection Officer may present an application to the Magistrate seeking one or more reliefs under the Act.',
    fullText:
      'Section 12 Protection of Women from Domestic Violence Act 2005 — Application to Magistrate. An aggrieved person or a Protection Officer or any other person on behalf of the aggrieved person may present an application to the Magistrate seeking one or more reliefs under this Act.',
    sourceName: 'India Code / Domestic Violence Act 2005',
    practiceAreas: ['family'],
    topics: ['domestic-violence', 'section-12', 'protection-order', 'application'],
  },
  {
    actId: 'domestic-violence',
    countryCode: 'IN',
    section: '17',
    title: 'Right to reside in a shared household',
    summary:
      'Every woman in a domestic relationship has the right to reside in the shared household, whether or not she has any right, title or beneficial interest in the same.',
    fullText:
      'Section 17 Protection of Women from Domestic Violence Act 2005 — Right to reside in a shared household. Notwithstanding anything contained in any other law for the time being in force, every woman in a domestic relationship shall have the right to reside in the shared household, whether or not she has any right, title or beneficial interest in the same.',
    sourceName: 'India Code / Domestic Violence Act 2005',
    practiceAreas: ['family'],
    topics: ['domestic-violence', 'section-17', 'shared-household', 'residence'],
  },
  {
    actId: 'domestic-violence',
    countryCode: 'IN',
    section: '18',
    title: 'Protection orders',
    summary:
      'Magistrate may pass protection orders prohibiting the respondent from committing acts of domestic violence, aiding or abetting such acts, or entering places frequented by the aggrieved person.',
    fullText:
      'Section 18 Protection of Women from Domestic Violence Act 2005 — Protection orders. The Magistrate may, after giving the aggrieved person and the respondent an opportunity of being heard and on being prima facie satisfied that domestic violence has taken place or is likely to take place, pass a protection order in favour of the aggrieved person.',
    sourceName: 'India Code / Domestic Violence Act 2005',
    practiceAreas: ['family'],
    topics: ['domestic-violence', 'section-18', 'protection-order'],
  },
  // ── Family Courts Act 1984 ───────────────────────────────────────────────────
  {
    actId: 'family-courts',
    countryCode: 'IN',
    section: '7',
    title: 'Jurisdiction of Family Courts',
    summary:
      'Family Courts have exclusive jurisdiction to entertain suits and proceedings relating to matrimonial causes, maintenance, guardianship, custody, and property disputes between spouses.',
    fullText:
      'Section 7 Family Courts Act 1984 — Jurisdiction. Subject to the other provisions of this Act, a Family Court shall have and exercise jurisdiction to entertain and try suits and proceedings of the nature referred to in the Explanation to sub-section (1) of section 7 of the Family Courts Act, 1984.',
    sourceName: 'India Code / Family Courts Act 1984',
    practiceAreas: ['family'],
    topics: ['family-courts', 'section-7', 'jurisdiction'],
  },
  {
    actId: 'family-courts',
    countryCode: 'IN',
    section: '10',
    title: 'Procedure generally',
    summary:
      'Family Courts are guided by the principles of substantive justice and may adopt their own procedure; they are not bound by the Code of Civil Procedure except as provided.',
    fullText:
      'Section 10 Family Courts Act 1984 — Procedure generally. In suits or proceedings before a Family Court, it shall not be necessary to record the evidence of witnesses at length, but the judge shall record the substance of what the witness deposes and sign the record.',
    sourceName: 'India Code / Family Courts Act 1984',
    practiceAreas: ['family'],
    topics: ['family-courts', 'section-10', 'procedure'],
  },
  // ── Special Marriage Act 1954 ──────────────────────────────────────────────
  {
    actId: 'special-marriage',
    countryCode: 'IN',
    section: '4',
    title: 'Conditions relating to solemnization of special marriages',
    summary:
      'Sets conditions for special marriages including minimum age, absence of subsisting marriage, prohibited degrees of relationship, and mental capacity.',
    fullText:
      'Section 4 Special Marriage Act 1954 — Conditions relating to solemnization of special marriages. A marriage may be solemnized under this Act between any two persons if neither party has a spouse living at the time of the marriage, neither is incapable of giving valid consent, the male has completed twenty-one years and the female eighteen years, and the parties are not within prohibited degrees of relationship.',
    sourceName: 'India Code / Special Marriage Act 1954',
    sourceUrl: 'https://www.indiacode.nic.in/bitstream/123456789/15480/1/special_marriage_act.pdf',
    practiceAreas: ['family'],
    topics: ['special-marriage', 'section-4', 'conditions'],
  },
  {
    actId: 'special-marriage',
    countryCode: 'IN',
    section: '13',
    title: 'Divorce',
    summary:
      'Either party may present a petition for divorce on grounds including voluntary sexual intercourse, desertion, cruelty, unsoundness of mind, and mutual consent.',
    fullText:
      'Section 13 Special Marriage Act 1954 — Divorce. Any marriage solemnized under this Act may, on a petition presented by either the husband or the wife, be dissolved by a decree of divorce on grounds including voluntary sexual intercourse with any person other than his or her spouse, desertion for two years, cruelty, and mutual consent.',
    sourceName: 'India Code / Special Marriage Act 1954',
    practiceAreas: ['family'],
    topics: ['special-marriage', 'section-13', 'divorce'],
  },
  {
    actId: 'special-marriage',
    countryCode: 'IN',
    section: '27',
    title: 'Restitution of conjugal rights',
    summary:
      'Either party may petition the district court for restitution of conjugal rights when the other has withdrawn from society without reasonable excuse.',
    fullText:
      'Section 27 Special Marriage Act 1954 — Restitution of conjugal rights. When either the husband or the wife has, without reasonable excuse, withdrawn from the society of the other, the aggrieved party may apply, by petition to the district court, for restitution of conjugal rights.',
    sourceName: 'India Code / Special Marriage Act 1954',
    practiceAreas: ['family'],
    topics: ['special-marriage', 'section-27', 'restitution'],
  },
  // ── Income-tax Act 1961 (priority sections) ────────────────────────────────
  {
    actId: 'income-tax',
    countryCode: 'IN',
    section: '2',
    title: 'Definitions',
    summary:
      'Defines key terms including assessee, assessment year, income, person, previous year, and total income for the purposes of the Act.',
    fullText:
      'Section 2 Income-tax Act 1961 — Definitions. In this Act, unless the context otherwise requires, expressions including "assessee", "assessment year", "income", "person", "previous year" and "total income" have the meanings assigned to them in the various clauses of this section.',
    sourceName: 'India Code / Income-tax Act 1961',
    practiceAreas: ['taxation'],
    topics: ['income-tax', 'section-2', 'definitions'],
  },
  {
    actId: 'income-tax',
    countryCode: 'IN',
    section: '80C',
    title: 'Deduction in respect of life insurance premia, deferred annuity, contributions to provident fund, etc.',
    summary:
      'Allows deduction up to one lakh fifty thousand rupees in respect of specified investments and payments including LIC premia, PPF, NSC, tuition fees, and housing loan principal repayment.',
    fullText:
      'Section 80C Income-tax Act 1961 — Deduction in respect of life insurance premia, deferred annuity, contributions to provident fund, subscription to certain equity shares or debentures, etc. In computing the total income of an assessee, being an individual or a Hindu undivided family, there shall be deducted the whole of the amount paid or deposited in the previous year, up to one lakh fifty thousand rupees, in specified savings and investments.',
    sourceName: 'India Code / Income-tax Act 1961',
    practiceAreas: ['taxation'],
    topics: ['income-tax', 'section-80c', 'deduction'],
  },
  {
    actId: 'income-tax',
    countryCode: 'IN',
    section: '139',
    title: 'Return of income',
    summary:
      'Every person whose total income exceeds the maximum amount not chargeable to tax must furnish a return of income in the prescribed form and manner.',
    fullText:
      'Section 139 Income-tax Act 1961 — Return of income. Every person, if his total income or the total income of any other person in respect of which he is assessable under this Act during the previous year exceeded the maximum amount which is not chargeable to income-tax, shall, on or before the due date, furnish a return of his income.',
    sourceName: 'India Code / Income-tax Act 1961',
    practiceAreas: ['taxation'],
    topics: ['income-tax', 'section-139', 'return'],
  },
  {
    actId: 'income-tax',
    countryCode: 'IN',
    section: '143',
    title: 'Assessment',
    summary:
      'Provides for summary assessment without calling the assessee (section 143(1)) and scrutiny assessment following notice (section 143(3)).',
    fullText:
      'Section 143 Income-tax Act 1961 — Assessment. Where a return has been made under section 139, or in response to a notice under section 142(1), the Assessing Officer shall assess the total income or loss and determine the sum payable by the assessee or refund due.',
    sourceName: 'India Code / Income-tax Act 1961',
    practiceAreas: ['taxation'],
    topics: ['income-tax', 'section-143', 'assessment'],
  },
  {
    actId: 'income-tax',
    countryCode: 'IN',
    section: '271',
    title: 'Failure to furnish returns, comply with notices, concealment of income, etc.',
    summary:
      'Imposes penalties for failure to furnish returns, comply with notices, concealment of particulars of income, and furnishing inaccurate particulars.',
    fullText:
      'Section 271 Income-tax Act 1961 — Failure to furnish returns, comply with notices, concealment of income, etc. The Assessing Officer or Commissioner may direct that such person shall pay by way of penalty amounts as specified for failure to furnish return of income, failure to comply with notices, and concealment of income.',
    sourceName: 'India Code / Income-tax Act 1961',
    practiceAreas: ['taxation'],
    topics: ['income-tax', 'section-271', 'penalty'],
  },
  // ── United States ──────────────────────────────────────────────────────────
  {
    actId: 'flsa',
    countryCode: 'US',
    section: '207',
    title: 'Maximum hours — overtime compensation',
    summary:
      'Employers must pay covered non-exempt employees at least one and one-half times the regular rate for hours worked over 40 in a workweek.',
    fullText:
      '29 U.S.C. § 207 — Maximum hours. No employer shall employ any employee who is engaged in commerce for a workweek longer than forty hours unless the employee receives compensation at a rate not less than one and one-half times the regular rate.',
    sourceName: 'Cornell LII / U.S. Code',
    sourceUrl: 'https://www.law.cornell.edu/uscode/text/29/207',
    practiceAreas: ['employment'],
    topics: ['flsa', 'overtime', '29-usc-207'],
  },
  // ── Kenya ──────────────────────────────────────────────────────────────────
  {
    actId: 'cap-63',
    countryCode: 'KE',
    section: '203',
    title: 'Definition of murder',
    summary:
      'Kenya Penal Code definition of murder and punishment including death penalty where applicable under the Constitution.',
    fullText:
      'Penal Code (Cap 63) Section 203 — Any person convicted of murder shall be sentenced to death, subject to constitutional limitations on mandatory death sentences as interpreted by the Supreme Court of Kenya.',
    sourceName: 'Kenya Law',
    sourceUrl: 'https://new.kenyalaw.org',
    practiceAreas: ['criminal'],
    topics: ['cap-63', 'penal-code', 'murder', 'section-203'],
  },
  // ── United Kingdom ─────────────────────────────────────────────────────────
  {
    actId: 'era-1996',
    countryCode: 'GB',
    section: '98',
    title: 'Unfair dismissal — right to written statement of reasons',
    summary:
      'An employee who is dismissed and has at least two years continuous employment may request a written statement of the reasons for dismissal.',
    fullText:
      'Employment Rights Act 1996 s.98 — Determination of the question of fairness. It is for the employer to show the reason for dismissal and that it was a potentially fair reason; the employment tribunal shall determine whether the employer acted reasonably.',
    sourceName: 'legislation.gov.uk',
    sourceUrl: 'https://www.legislation.gov.uk/ukpga/1996/18/section/98',
    practiceAreas: ['employment'],
    topics: ['era-1996', 'unfair-dismissal', 'section-98'],
  },
  // ── United States — additional priority sections ────────────────────────────
  {
    actId: 'flsa',
    countryCode: 'US',
    section: '206',
    title: 'Minimum wage',
    summary:
      'Every employer shall pay each employee a minimum wage not less than the federally prescribed minimum hourly rate.',
    fullText:
      '29 U.S.C. § 206 — Minimum wage. Every employer shall pay to each of his employees who in any workweek is engaged in commerce wages at the following rates: not less than the statutory minimum wage per hour.',
    sourceName: 'Cornell LII / U.S. Code',
    sourceUrl: 'https://www.law.cornell.edu/uscode/text/29/206',
    practiceAreas: ['employment'],
    topics: ['flsa', 'minimum-wage', '29-usc-206'],
  },
  {
    actId: 'title-vii',
    countryCode: 'US',
    section: '2000e-2',
    title: 'Unlawful employment practices',
    summary:
      'It shall be an unlawful employment practice for an employer to discriminate against any individual because of race, color, religion, sex, or national origin.',
    fullText:
      '42 U.S.C. § 2000e-2 — Unlawful employment practices. It shall be an unlawful employment practice for an employer to fail or refuse to hire or to discharge any individual, or otherwise to discriminate against any individual with respect to his compensation, terms, conditions, or privileges of employment, because of such individual\'s race, color, religion, sex, or national origin.',
    sourceName: 'Cornell LII / U.S. Code',
    sourceUrl: 'https://www.law.cornell.edu/uscode/text/42/2000e-2',
    practiceAreas: ['employment'],
    topics: ['title-vii', 'discrimination', '42-usc-2000e-2'],
  },
  {
    actId: 'ada',
    countryCode: 'US',
    section: '12112',
    title: 'Prohibition on discrimination',
    summary:
      'No covered entity shall discriminate against a qualified individual on the basis of disability in regard to job application procedures, hiring, promotion, or other terms of employment.',
    fullText:
      '42 U.S.C. § 12112 — Discrimination. No covered entity shall discriminate against a qualified individual on the basis of disability in regard to job application procedures, the hiring, advancement, or discharge of employees, employee compensation, job training, and other terms, conditions, and privileges of employment.',
    sourceName: 'Cornell LII / U.S. Code',
    sourceUrl: 'https://www.law.cornell.edu/uscode/text/42/12112',
    practiceAreas: ['employment', 'civil_rights'],
    topics: ['ada', 'disability-discrimination', '42-usc-12112'],
  },
  {
    actId: 'fmla',
    countryCode: 'US',
    section: '2612',
    title: 'Leave requirement',
    summary:
      'An eligible employee shall be entitled to 12 workweeks of leave per year for birth, adoption, serious health condition of employee or family member.',
    fullText:
      '29 U.S.C. § 2612 — Leave requirement. An eligible employee shall be entitled to a total of 12 workweeks of leave during any 12-month period for the birth of a child, placement of a child for adoption, serious health condition of the employee, or serious health condition of a spouse, child, or parent.',
    sourceName: 'Cornell LII / U.S. Code',
    sourceUrl: 'https://www.law.cornell.edu/uscode/text/29/2612',
    practiceAreas: ['employment'],
    topics: ['fmla', 'leave', '29-usc-2612'],
  },
  {
    actId: 'bankruptcy-code',
    countryCode: 'US',
    section: '362',
    title: 'Automatic stay',
    summary:
      'Filing a bankruptcy petition operates as a stay of all collection and enforcement actions against the debtor and the bankruptcy estate.',
    fullText:
      '11 U.S.C. § 362 — Automatic stay. A petition filed under this title operates as a stay, applicable to all entities, of the commencement or continuation of a judicial, administrative, or other action against the debtor, enforcement of judgments against the debtor, and acts to obtain possession of or exercise control over property of the estate.',
    sourceName: 'Cornell LII / U.S. Code',
    sourceUrl: 'https://www.law.cornell.edu/uscode/text/11/362',
    practiceAreas: ['bankruptcy'],
    topics: ['bankruptcy-code', 'automatic-stay', '11-usc-362'],
  },
  {
    actId: 'bankruptcy-code',
    countryCode: 'US',
    section: '541',
    title: 'Property of the estate',
    summary:
      'Defines what constitutes property of the bankruptcy estate, including all legal or equitable interests of the debtor in property as of the commencement of the case.',
    fullText:
      '11 U.S.C. § 541 — Property of the estate. The commencement of a case creates an estate. Such estate is comprised of all the following property: all legal or equitable interests of the debtor in property as of the commencement of the case; interests of the debtor and the debtor\'s spouse in community property; and property that the trustee recovers.',
    sourceName: 'Cornell LII / U.S. Code',
    sourceUrl: 'https://www.law.cornell.edu/uscode/text/11/541',
    practiceAreas: ['bankruptcy'],
    topics: ['bankruptcy-code', 'estate-property', '11-usc-541'],
  },
  {
    actId: 'ina',
    countryCode: 'US',
    section: '1182',
    title: 'Inadmissible aliens',
    summary:
      'Lists classes of aliens who are inadmissible to the United States, including health grounds, criminal grounds, security grounds, and public charge grounds.',
    fullText:
      '8 U.S.C. § 1182 — Inadmissible aliens. Except as otherwise provided, the following classes of aliens shall be ineligible to receive visas and shall be excluded from admission into the United States: aliens with communicable diseases, aliens convicted of crimes of moral turpitude, aliens who are or have been members of a totalitarian party, and aliens likely to become a public charge.',
    sourceName: 'Cornell LII / U.S. Code',
    sourceUrl: 'https://www.law.cornell.edu/uscode/text/8/1182',
    practiceAreas: ['immigration'],
    topics: ['ina', 'inadmissibility', '8-usc-1182'],
  },
  {
    actId: 'usc-18',
    countryCode: 'US',
    section: '1343',
    title: 'Wire fraud',
    summary:
      'Whoever uses wire, radio, or television communications in interstate commerce to execute a scheme to defraud shall be punished by fine or imprisonment up to 20 years.',
    fullText:
      '18 U.S.C. § 1343 — Fraud by wire, radio, or television. Whoever, having devised or intending to devise any scheme or artifice to defraud, or for obtaining money or property by means of false or fraudulent pretenses, representations, or promises, transmits or causes to be transmitted by means of wire, radio, or television communication in interstate or foreign commerce any writings for the purpose of executing such scheme shall be fined or imprisoned not more than 20 years.',
    sourceName: 'Cornell LII / U.S. Code',
    sourceUrl: 'https://www.law.cornell.edu/uscode/text/18/1343',
    practiceAreas: ['criminal'],
    topics: ['usc-18', 'wire-fraud', '18-usc-1343'],
  },
  {
    actId: 'usc-18',
    countryCode: 'US',
    section: '1346',
    title: 'Definition of scheme or artifice to defraud — honest services fraud',
    summary:
      'Defines "scheme or artifice to defraud" to include a scheme to deprive another of the intangible right of honest services.',
    fullText:
      '18 U.S.C. § 1346 — Definition of "scheme or artifice to defraud". For the purposes of this chapter, the term "scheme or artifice to defraud" includes a scheme or artifice to deprive another of the intangible right of honest services.',
    sourceName: 'Cornell LII / U.S. Code',
    sourceUrl: 'https://www.law.cornell.edu/uscode/text/18/1346',
    practiceAreas: ['criminal'],
    topics: ['usc-18', 'honest-services-fraud', '18-usc-1346'],
  },
  // ── United Kingdom — additional priority sections ───────────────────────────
  {
    actId: 'equality-act-2010',
    countryCode: 'GB',
    section: '4',
    title: 'Protected characteristics',
    summary:
      'Lists the nine protected characteristics: age, disability, gender reassignment, marriage and civil partnership, pregnancy and maternity, race, religion or belief, sex, and sexual orientation.',
    fullText:
      'Equality Act 2010 s.4 — Protected characteristics. The following characteristics are protected characteristics: age; disability; gender reassignment; marriage and civil partnership; pregnancy and maternity; race; religion or belief; sex; sexual orientation.',
    sourceName: 'legislation.gov.uk',
    sourceUrl: 'https://www.legislation.gov.uk/ukpga/2010/15/section/4',
    practiceAreas: ['employment', 'civil_rights'],
    topics: ['equality-act-2010', 'protected-characteristics', 'section-4'],
  },
  {
    actId: 'equality-act-2010',
    countryCode: 'GB',
    section: '13',
    title: 'Direct discrimination',
    summary:
      'A person discriminates against another if, because of a protected characteristic, they treat that person less favourably than they treat or would treat others.',
    fullText:
      'Equality Act 2010 s.13 — Direct discrimination. A person discriminates against another if, because of a protected characteristic, A treats B less favourably than A treats or would treat others.',
    sourceName: 'legislation.gov.uk',
    sourceUrl: 'https://www.legislation.gov.uk/ukpga/2010/15/section/13',
    practiceAreas: ['employment', 'civil_rights'],
    topics: ['equality-act-2010', 'direct-discrimination', 'section-13'],
  },
  {
    actId: 'pace-1984',
    countryCode: 'GB',
    section: '24',
    title: 'Arrest without warrant — constables',
    summary:
      'A constable may arrest without warrant anyone who is about to commit, is committing, or has committed an indictable offence, if there are reasonable grounds for believing arrest is necessary.',
    fullText:
      'Police and Criminal Evidence Act 1984 s.24 — Arrest without warrant: constables. A constable may arrest without a warrant anyone who is about to commit an offence, anyone who is in the act of committing an offence, and anyone whom he has reasonable grounds for suspecting to be about to commit an offence or to be committing an offence.',
    sourceName: 'legislation.gov.uk',
    sourceUrl: 'https://www.legislation.gov.uk/ukpga/1984/60/section/24',
    practiceAreas: ['criminal'],
    topics: ['pace-1984', 'arrest-without-warrant', 'section-24'],
  },
  {
    actId: 'companies-act-2006',
    countryCode: 'GB',
    section: '172',
    title: 'Duty to promote the success of the company',
    summary:
      'A director must act in the way they consider, in good faith, would be most likely to promote the success of the company for the benefit of its members as a whole.',
    fullText:
      'Companies Act 2006 s.172 — Duty to promote the success of the company. A director of a company must act in the way he considers, in good faith, would be most likely to promote the success of the company for the benefit of its members as a whole, having regard to the long-term consequences, interests of employees, community and environmental impact, and the desirability of maintaining a reputation for high standards of business conduct.',
    sourceName: 'legislation.gov.uk',
    sourceUrl: 'https://www.legislation.gov.uk/ukpga/2006/46/section/172',
    practiceAreas: ['corporate'],
    topics: ['companies-act-2006', 'directors-duties', 'section-172'],
  },
  {
    actId: 'companies-act-2006',
    countryCode: 'GB',
    section: '174',
    title: 'Duty to exercise reasonable care, skill and diligence',
    summary:
      'A director must exercise the care, skill and diligence that would be exercised by a reasonably diligent person with both the general knowledge of a director and the specific knowledge and experience of the actual director.',
    fullText:
      'Companies Act 2006 s.174 — Duty to exercise reasonable care, skill and diligence. A director of a company must exercise the care, skill and diligence that would be exercised by a reasonably diligent person with both the general knowledge, skill and experience that may reasonably be expected of a person carrying out the functions carried out by the director, and the general knowledge, skill and experience that the director has.',
    sourceName: 'legislation.gov.uk',
    sourceUrl: 'https://www.legislation.gov.uk/ukpga/2006/46/section/174',
    practiceAreas: ['corporate'],
    topics: ['companies-act-2006', 'directors-duties', 'section-174'],
  },
  {
    actId: 'data-protection-act-2018',
    countryCode: 'GB',
    section: '2',
    title: 'Meaning of "sensitive processing"',
    summary:
      'Defines sensitive processing as processing of special categories of personal data including health, biometric, genetic, racial or ethnic origin, political opinions, religious beliefs, and sexual orientation.',
    fullText:
      'Data Protection Act 2018 s.2 — Meaning of "sensitive processing". Processing is "sensitive processing" if it constitutes processing of special categories of data as defined in Article 9 of the UK GDPR, or processing of personal data relating to criminal convictions and offences.',
    sourceName: 'legislation.gov.uk',
    sourceUrl: 'https://www.legislation.gov.uk/ukpga/2018/12/section/2',
    practiceAreas: ['privacy'],
    topics: ['data-protection-act-2018', 'sensitive-processing', 'section-2', 'gdpr'],
  },
  {
    actId: 'housing-act-1988',
    countryCode: 'GB',
    section: '21',
    title: 'Recovery of possession on expiry or termination of assured shorthold tenancy',
    summary:
      'A landlord may recover possession of an assured shorthold tenancy by serving a section 21 notice requiring at least two months notice to quit at the end of a fixed term or during a periodic tenancy.',
    fullText:
      'Housing Act 1988 s.21 — Recovery of possession on expiry or termination of assured shorthold tenancy. Without prejudice to any right of the landlord to recover possession on grounds in Schedule 2, on or after the coming to an end of an assured shorthold tenancy, the court shall make an order for possession if the landlord has served proper notice in writing.',
    sourceName: 'legislation.gov.uk',
    sourceUrl: 'https://www.legislation.gov.uk/ukpga/1988/50/section/21',
    practiceAreas: ['property'],
    topics: ['housing-act-1988', 'section-21-notice', 'eviction'],
  },
  // ── Kenya — additional priority sections ────────────────────────────────────
  {
    actId: 'constitution-ke',
    countryCode: 'KE',
    section: '25',
    title: 'Fundamental rights and freedoms that may not be limited',
    summary:
      'Lists rights that cannot be limited even under a state of emergency: freedom from torture, cruel treatment, slavery, and the right to a fair trial and habeas corpus.',
    fullText:
      'Constitution of Kenya 2010 Article 25 — Fundamental rights and freedoms that may not be limited. Despite any other provision in this Constitution, the following rights and fundamental freedoms shall not be limited: freedom from torture and cruel, inhuman or degrading treatment or punishment; freedom from slavery or servitude; the right to a fair trial; and the right to an order of habeas corpus.',
    sourceName: 'Kenya Law',
    sourceUrl: 'https://new.kenyalaw.org/akn/ke/act/2010/constitution',
    practiceAreas: ['constitutional'],
    topics: ['constitution-ke', 'article-25', 'non-derogable-rights'],
  },
  {
    actId: 'constitution-ke',
    countryCode: 'KE',
    section: '40',
    title: 'Protection of right to property',
    summary:
      'Every person has the right, in any part of Kenya, to acquire and own property, either individually or in association with others. The State shall not deprive a person of property unless required for public use and just compensation is promptly paid.',
    fullText:
      'Constitution of Kenya 2010 Article 40 — Protection of right to property. Subject to Article 65, every person has the right, either individually or in association with others, to acquire and own property anywhere in Kenya. Parliament shall not enact a law that permits the State to deprive a person of property unless the deprivation results in prompt payment of just compensation to the person.',
    sourceName: 'Kenya Law',
    sourceUrl: 'https://new.kenyalaw.org/akn/ke/act/2010/constitution',
    practiceAreas: ['constitutional', 'property'],
    topics: ['constitution-ke', 'article-40', 'right-to-property'],
  },
  {
    actId: 'constitution-ke',
    countryCode: 'KE',
    section: '50',
    title: 'Fair hearing',
    summary:
      'Every person has the right to have any dispute that can be resolved by the application of law decided in a fair and public hearing before a court or independent tribunal.',
    fullText:
      'Constitution of Kenya 2010 Article 50 — Fair hearing. Every person has the right to have any dispute that can be resolved by the application of law decided in a fair and public hearing before a court or, if appropriate, another independent and impartial tribunal or body. Every accused person has the right to a fair trial including the right to be presumed innocent until proved guilty.',
    sourceName: 'Kenya Law',
    sourceUrl: 'https://new.kenyalaw.org/akn/ke/act/2010/constitution',
    practiceAreas: ['constitutional', 'criminal'],
    topics: ['constitution-ke', 'article-50', 'fair-trial'],
  },
  {
    actId: 'employment-act-2007',
    countryCode: 'KE',
    section: '41',
    title: 'Disciplinary procedure before dismissal',
    summary:
      'An employer shall not terminate the employment of an employee without notifying the employee of the reason for dismissal and hearing the employee before the decision is made.',
    fullText:
      'Employment Act 2007 s.41 — Disciplinary procedure before dismissal. Subject to section 44, an employer shall before terminating the employment of an employee on account of misconduct, poor performance, or physical incapacity, notify the employee of the reason for the dismissal and allow the employee an opportunity to respond.',
    sourceName: 'Kenya Law',
    sourceUrl: 'https://new.kenyalaw.org/akn/ke/act/2007/11/eng@2022-12-31',
    practiceAreas: ['employment'],
    topics: ['employment-act-2007', 'section-41', 'disciplinary-procedure', 'dismissal'],
  },
  {
    actId: 'employment-act-2007',
    countryCode: 'KE',
    section: '45',
    title: 'Unfair termination of employment',
    summary:
      'Defines unfair termination and lists circumstances in which termination is automatically unfair, including trade union membership, pregnancy, and making a complaint against the employer.',
    fullText:
      'Employment Act 2007 s.45 — Unfair termination. A termination of employment is unfair if the employer fails to prove that it was made for a valid reason and was made in accordance with fair procedure. Termination is automatically unfair if it relates to trade union membership, pregnancy, and seeking to enforce a right under this Act.',
    sourceName: 'Kenya Law',
    sourceUrl: 'https://new.kenyalaw.org/akn/ke/act/2007/11/eng@2022-12-31',
    practiceAreas: ['employment'],
    topics: ['employment-act-2007', 'section-45', 'unfair-termination'],
  },
  {
    actId: 'cap-63',
    countryCode: 'KE',
    section: '251',
    title: 'Obtaining by false pretences',
    summary:
      'Any person who by any false pretence, and with intent to defraud, obtains from any other person anything capable of being stolen is guilty of a felony.',
    fullText:
      'Penal Code (Cap 63) s.251 — Obtaining by false pretences. Any person who by any false pretence, and with intent to defraud, obtains from any other person anything capable of being stolen, or induces any other person to deliver to any person anything capable of being stolen, is guilty of a felony and is liable to imprisonment for three years.',
    sourceName: 'Kenya Law',
    sourceUrl: 'https://new.kenyalaw.org/akn/ke/act/1930/10/eng@2023-12-11',
    practiceAreas: ['criminal'],
    topics: ['cap-63', 'penal-code', 'false-pretences', 'section-251'],
  },
  {
    actId: 'land-act-2012',
    countryCode: 'KE',
    section: '107',
    title: 'Compulsory acquisition of land — notice of intention',
    summary:
      'The National Land Commission may acquire land compulsorily for public purposes by publishing a gazette notice of intention to acquire and paying just compensation.',
    fullText:
      'Land Act 2012 s.107 — Notice of intention to acquire. Where the national or county government intends to acquire land compulsorily, the Commission shall publish a notice in the Gazette setting out the description of the land and the purpose for which it is intended to be acquired, and shall serve a copy of the notice on all persons interested.',
    sourceName: 'Kenya Law',
    sourceUrl: 'https://new.kenyalaw.org/akn/ke/act/2012/6/eng@2012-05-02',
    practiceAreas: ['property'],
    topics: ['land-act-2012', 'compulsory-acquisition', 'section-107'],
  },
];
