/**
 * Verbatim templates from University of Delhi, Faculty of Law
 * "Drafting, Pleadings and Conveyance" — LB-502, 2025 Edition
 *
 * Every template here is word-for-word from the DU PDF.
 * The only modification: blank spaces (…….. / _______ / (date) / Rs. _____)
 * are replaced with {{camelCasePlaceholders}} so values can be merged in.
 *
 * AI role: fill blank placeholders only. The structure, headings, prayer clauses,
 * and statutory language are NEVER altered by AI.
 */

// ─── CRIMINAL LAW ────────────────────────────────────────────────────────────

export const TEMPLATE_REGULAR_BAIL = `IN THE COURT OF {{court}} (DISTRICT {{district}}), {{courtLocation}} COURT, DELHI
BAIL APPLICATION NO. {{bailAppNo}} OF {{year}}

IN THE MATTER OF:

{{accusedName}}
S/o {{accusedFatherName}}
R/o {{accusedAddress}}                                        …APPLICANT

VERSUS

STATE                                                         …RESPONDENT/COMPLAINANT

FIR NO. {{firNumber}} OF {{firYear}} UNDER SECTION {{sections}} BNS
POLICE STATION {{policeStation}}

APPLICATION FOR GRANT OF BAIL UNDER SECTION 480 OF THE
BHARATIYA NAGARIK SURAKSHA SANHITA, 2023

Most Respectfully Showeth:

1. That the accused above named was arrested by the police on {{arrestDate}} and is in judicial custody since then. It is alleged that on {{dateOfAllegedOffence}}, {{allegedFacts}}.

2. That the accused has been falsely implicated in the instant case and he has nothing to do with the alleged offence.

3. That nothing was recovered from the possession of the accused or at his instance and the so called case property has been planted upon the accused.

4. That the accused is a law abiding citizen and belongs to a very respectable family. He has never indulged in any illegal activities and commands respect and admiration in his locality.

5. {{groundForBail1}}

6. {{groundForBail2}}

7. {{groundForBail3}}

8. That the accused is a permanent resident of Delhi and there are no chances of his absconding in case he is released on bail.

9. That there is no chance of the accused absconding or tampering with the prosecution evidence in the event of release on bail.

10. That the accused undertakes to join the investigation as and when directed to do so.

11. That the accused is not a previous convict and has not been involved in any case of this nature except the present case.

12. That the present case is a result of clear manipulation by the police.

13. That the accused from all accounts is an innocent person.

PRAYER:

It is therefore respectfully prayed that the accused may kindly be released on bail during the pendency of this case.

APPLICANT

Place:                                                        THROUGH
Date:                                                         ADVOCATE

Note: To be supported by affidavit of Pairokar and Vakalatnama duly attested by Jail Authorities.`;

export const TEMPLATE_ANTICIPATORY_BAIL = `IN THE COURT OF SESSIONS JUDGE (DISTRICT {{district}}), {{courtLocation}} COURT DELHI
ANTICIPATORY BAIL APPLICATION NO. {{abaNo}} OF {{year}}

IN THE MATTER OF:

{{applicantName}}
S/o {{applicantFatherName}}
R/o {{applicantAddress}}                                      …APPLICANT

VERSUS

STATE                                                         …RESPONDENT/COMPLAINANT

FIR NO. {{firNumber}} OF {{firYear}} UNDER SECTION {{sections}} BNS
POLICE STATION {{policeStation}}

APPLICATION FOR THE GRANT OF ANTICIPATORY BAIL UNDER SECTION 482 OF THE
BHARATIYA NAGARIK SURAKSHA SANHITA, 2023

Most Respectfully Showeth:

1. That the Applicant is {{applicantDescription}} residing at {{applicantAddress}}, Delhi. {{applicantBackground}}

2. The Applicant is a very respectable person of his locality and is a peace loving citizen.

3. {{circumstancesOfFalsImplication}}

4. {{additionalBackground}}

5. That on {{dateOfIncident}}, {{incidentFacts}}

6. That the police has registered a false FIR against the Applicant. A bare perusal of the said FIR reveals that {{firAnalysis}}.

7. That the FIR registered against the Applicant is absolutely false and incorrect. The Applicant is not at all involved in the alleged offence and has been falsely implicated by the police.

8. That the Applicant apprehends that he may be arrested in pursuance of the aforesaid false and fictitious complaint.

9. That the police officials have visited the premises of the Applicant in his absence and there is every likelihood of his being arrested in the instant case.

10. That the Applicant undertakes to join the investigation as and when directed to do so.

11. That the Applicant is a permanent resident of Delhi and there is no chance of his absconding in case he is granted anticipatory bail.

12. That the Applicant has never been involved in any criminal case except the present one.

PRAYER:

It is, therefore most respectfully prayed that the Applicant be released on bail in the event of his arrest and appropriate directions in this regard may please be sent to the concerned Investigating officer/S.H.O. Any other order/orders which this Hon'ble Court may deem fit and proper on the facts and circumstances of this case may also be passed.

APPLICANT

Place:                                                        THROUGH
Date:                                                         ADVOCATE

[Note: To be supported by affidavit]`;

export const TEMPLATE_MAINTENANCE_BNSS_144 = `IN THE COURT OF PRINCIPAL JUDGE, FAMILY COURT, {{courtLocation}} COURT (DISTRICT {{district}}), DELHI

MAINTENANCE APPLICATION NO. {{maintAppNo}} OF {{year}}

IN THE MATTER OF:

1. Smt. {{wifeName}}
   W/o {{husbandName}}
   R/o {{wifeAddress}}

2. {{childName}}
   S/o {{husbandName}}
   R/o {{wifeAddress}}
   through his mother and natural guardian Smt. {{wifeName}}          …APPLICANTS

VERSUS

{{husbandName}}
S/o {{husbandFatherName}}
R/o {{husbandAddress}}                                       …RESPONDENT

APPLICATION UNDER SECTION 144 OF THE BHARATIYA NAGARIK SURAKSHA SANHITA, 2023

Most Respectfully Showeth:

1. That the Applicant No. 1 is the legally wedded wife of the Respondent while Applicant No. 2 is the legitimate son of the Respondent.

2. That the Applicant No.1 was married to the Respondent according to the Hindu Rites and ceremonies on {{marriageDate}} at New Delhi and the Applicant No. 2 was born out of their wedlock on {{childDob}}. The Applicant No. 2 is staying with Applicant No. 1 at present.

3. That Applicant No. 1 and Respondent stayed together after their marriage and for the last two years proceeding {{separationDate}}, they were staying at Delhi.

4. That sometime during the period {{troublePeriod}}, the matrimonial life of the Applicant No. 1 and the Respondent got disturbed on account of {{reasonForMaritalDisturbance}}. The Applicant No. 1 made best possible efforts to persuade the Respondent to desist from such behaviour. However, the same had no effect on the Respondent. Rather, the behavior of the Respondent towards Applicant No. 1 became rude, cruel and oppressive, and finally on {{dateOfSeparation}}, the Respondent compelled the Applicant No. 1 to leave the matrimonial home along with Applicant No. 2. Since then, the Applicants are staying with Applicant No. 1's father.

5. That the Applicant No.1 has made repeated attempts to join the Respondent in the matrimonial home. However, the Respondent has refused to take back the Applicants.

6. That the Respondent is liable to maintain the Applicants who have repeatedly requested the Respondent to provide them the appropriate maintenance. However, the Respondent has not only refused/neglected to maintain the Applicants, but has also refused to return the articles belonging to Applicant No. 1 towards the dowry and Stridhan.

7. That the Respondent is {{respondentOccupation}} and is getting monthly emoluments of about Rs. {{respondentIncome}} per month and as such has sufficient means to maintain himself and the applicants. He has no encumbrances or liabilities except that of maintenance of the applicants.

8. That the Applicant No. 1 has no independent source of livelihood and as such is unable to maintain herself. She is staying with her father at Delhi and as such both the Applicants are dependant upon him.

9. That the Applicant No. 2 is a minor and is also staying with the Applicant No. 1. He is studying in {{childSchool}}, New Delhi, and his monthly expenditure including school fees, dresses etc. is more than Rs. {{childMonthlyExpense}}.

10. That the Applicants are residing at Delhi. This Hon'ble Court therefore is competent to entertain and try this petition.

PRAYER:

It is, therefore, most respectfully prayed that the orders for maintenance of the Applicants be passed and against the Respondent directing the Respondent to pay the monthly allowance of Rs. {{maintenanceForWife}} towards the maintenance of the Applicant No. 1 and Rs. {{maintenanceForChild}} towards the maintenance of the Applicant No. 2. The costs of these proceedings be also awarded to the applicants.

APPLICANTS

Place:                                                        THROUGH
Date:                                                         ADVOCATE

(Note: An affidavit is to be attached to this petition)`;

// ─── CIVIL PLEADINGS ─────────────────────────────────────────────────────────

export const TEMPLATE_SUIT_RECOVERY_CPC37 = `IN THE COURT OF DISTRICT JUDGE (DISTRICT {{district}}), {{courtLocation}} COURT, DELHI
SUIT NO. {{suitNo}} OF {{year}}
(SUIT UNDER ORDER XXXVII OF THE CODE OF CIVIL PROCEDURE, 1908)

IN THE MATTER OF:

{{plaintiffName}}
{{plaintiffDescription}}
Through its {{plaintiffRepresentative}}
{{plaintiffRepresentativeName}}                               …PLAINTIFF

VERSUS

{{defendantName}}
S/O {{defendantFatherName}}
R/O {{defendantAddress}}                                      …DEFENDANT

SUIT FOR RECOVERY OF RS. {{suitAmount}} ({{suitAmountWords}}) UNDER ORDER XXXVII OF THE CODE OF CIVIL PROCEDURE, 1908

MOST RESPECTFULLY SHOWETH:

1. That the Plaintiff is {{plaintiffDescription}}. {{plaintiffRepresentativeName}}, {{plaintiffRepresentativeDesignation}} of the Plaintiff is a duly constituted attorney of the Plaintiff and is authorized and competent to sign and verify the plaint, vakalatnama etc. and to institute this suit on behalf of the Plaintiff.

2. That the Plaintiff carries on the business of {{plaintiffBusiness}}. The Plaintiff is a {{plaintiffReputation}}.

3. That the Defendant is residing at {{defendantAddress}}.

4. That the Defendant approached the Plaintiff for {{serviceDescription}} some time in the year {{yearOfAgreement}}.

5. That the Plaintiff and the Defendant entered into an agreement for {{agreementDescription}}.

6. That the Plaintiff {{serviceCompleted}} and handed over the same to the Defendant sometime in {{completionDate}}.

7. That on {{billDate}}, the Plaintiff raised the final bill for Rs. {{billAmount}} on the Defendant on account of the {{serviceDescription}}.

8. That the Defendant handed over cheque no. {{chequeNo}} dated {{chequeDate}} for Rs. {{chequeAmount}} drawn on {{bankName}} to the Plaintiff.

9. That the cheque was presented by the Plaintiff, however the same was dishonoured upon presentation vide bank memo dated {{bounceDate}}.

10. That the Plaintiff immediately informed the Defendant about the dishonour of the said cheque and called upon the Defendant to make the payment of the said amount along with interest at the rate of {{interestRate}} per annum. However, the Defendant failed to pay the same to the Plaintiff despite repeated requests and reminders.

11. That the Plaintiff therefore finally issued a legal notice dated {{noticeDate}} to the Defendant calling upon the Defendant to clear the outstanding amount of Rs. {{outstandingAmount}} along with interest at the rate of {{interestRate}} per annum w.e.f. {{interestFrom}} upto the date of payment. However, no payment has been made by the Defendant despite the said notice.

12. That the Defendant is now liable to pay a sum of Rs. {{totalDue}} along with interest at the rate of {{interestRate}} per annum from the date on the Plaintiff's bill. The Plaintiff is claiming interest from {{interestFrom}} upto the date of filing of this suit at the rate of {{interestRate}} per annum.

13. That the cause of action in favour of the Plaintiff and against the Defendant first arose in {{causeOfActionDate}} when the Plaintiff was approached by the Defendant. The cause of action is still subsisting as the Defendant has failed to pay the outstanding amount despite repeated oral and written requests and reminders from the Plaintiff.

14. The suit is within the period of limitation.

15. This Hon'ble Court has jurisdiction to entertain this suit because the part of the cause of action arose within its territorial jurisdiction. {{jurisdictionFacts}}

16. The value of this suit for the purposes of court fee and jurisdiction is Rs. {{courtFeeValue}} on which court fee of Rs. {{courtFee}} is paid.

17. That this suit is filed under Order XXXVII of the Code of Civil Procedure and no relief has been claimed which does not fall within the ambit of Order XXXVII.

PRAYER: It is, therefore most respectfully prayed that this Hon'ble Court may be pleased to:

(a) Pass a decree for Rs. {{suitAmount}} in favour of the Plaintiff and against the Defendant;

(b) award interest at the rate of {{interestRate}} per annum from {{interestFrom}} upto the date of filing the suit, pendente lite and future interest at the rate of {{interestRate}} per annum on the above stated amount in favour of the Plaintiff and against the Defendant;

(c) award cost of the suit in favour of the Plaintiff and against the Defendant; and

(d) pass such other and further order(s) as may be deemed fit and proper on the facts and in the circumstances of this case.

Plaintiff

Place:                                                        Through
Date:                                                         Advocate

VERIFICATION:
Verified at Delhi on this {{verificationDay}} day of {{verificationMonth}} 20{{verificationYear}} that the contents of paras 1 to {{lastFactPara}} of the plaint are true to my knowledge derived from the records of the Plaintiff maintained in the ordinary course of its business, those of paras {{fromInfoPara}} to {{toInfoPara}} are true on information received and believed to be true and last para is the humble prayer to this Hon'ble Court.

Plaintiff

[NOTE: The above plaint must be supported by an Affidavit]`;

export const TEMPLATE_SUIT_PERMANENT_INJUNCTION = `IN THE COURT OF SENIOR CIVIL JUDGE (DISTRICT {{district}}), {{courtLocation}} COURT, DELHI
SUIT NO. {{suitNo}} OF {{year}}

IN THE MATTER OF:

Sh. {{plaintiffName}}
S/o {{plaintiffFatherName}}
R/o {{plaintiffAddress}}                                      …PLAINTIFF

VERSUS

1. Sh. {{defendant1Name}}
   S/o {{defendant1FatherName}}
   R/o {{defendant1Address}}

2. {{defendant2Name}}
   S/o {{defendant2FatherName}}
   R/o {{defendant2Address}}                                  …DEFENDANTS

SUIT FOR PERMANENT INJUNCTION

MOST RESPECTFULLY SHOWETH:

1. That the plaintiff is the permanent resident of the above-mentioned address in property bearing no. {{propertyNo}} for the last many years and is living with {{livingSituation}}.

2. That the plaintiff is a tenant in respect of the above said property bearing no. {{propertyNo}} consisting of {{propertyDescription}} for Rent of Rs. {{monthlyRent}} per month excluding electricity and water charges under the tenancy of {{landlordName}}.

3. That the plaintiff spent a huge amount on the construction of {{constructionDetails}} in the above said premises at the request of {{requestedBy}}.

4. That at present the plaintiff is having the possession of premises {{propertyNo}} and is having the whole necessary documents/record regarding possession but the above said defendants are intending to disturb the peaceful physical possession of the plaintiff of the above said premises.

5. That the plaintiff is having the whole necessary household goods which are lying/kept in the above said premises and is living peacefully.

6. That the plaintiff has paid the agreed rent @ Rs. {{monthlyRent}} per month to {{landlordName}} upto {{rentPaidUpto}}.

7. That on {{threatDate1}} the above said defendants came to the above said premises of the plaintiff and threatened the plaintiff to vacate the tenanted premises immediately otherwise the plaintiff would have to face dire consequences. The defendants openly threatened and tried to dispossess the plaintiff forcibly and illegally.

8. That immediately on the same date the plaintiff rushed to the police post {{policeStation}} to lodge his report against the defendants regarding such incident but duty officer did not lodge the report of the plaintiff.

9. That on {{noticeDate}}, the plaintiff sent a notice to the defendants and copy to Chowki Incharge Police Post {{policeStation}} by Regd. A.D. but Police Post {{policeStation}} staff has not taken any action against the defendants for reasons best known to them.

10. That on {{threatDate2}}, the defendants along with unknown persons came to the above said premises, knocked at the door at odd hours and threatened the plaintiff to come out of the room. The neighbourers gathered there and they restrained the defendants from dispossessing the plaintiff forcibly and illegally.

11. That on {{latestAttemptDate}}, the plaintiff again went to the police post {{policeStation}} to lodge the report against the defendants but no Police Officer of police post {{policeStation}} is ready to listen against the defendants and they advised the plaintiff to approach the competent court of law to seek his remedy and to get injunction order against the defendants.

12. That the plaintiff has no other efficacious remedy except to approach this Hon'ble court for seeking relief of injunction against the defendants from interfering in the peaceful possession of the premises.

13. That the cause of action arose on different date when the defendants threatened the plaintiff to vacate the premises and threatened the plaintiff of dire consequences and further to dispossess him from the above premises forcibly and illegally. The cause of action is still subsisting.

14. The value of this suit for the purposes of court fee and jurisdiction is Rs. {{courtFeeValue}} on which court fee of Rs. {{courtFee}} is paid.

15. This Hon'ble Court has jurisdiction to entertain this suit because the said premises is situated within the territorial jurisdiction of this Hon'ble Court.

PRAYER:
It is, therefore most respectfully prayed that this Hon'ble Court may be pleased to:

(a) pass the decree for Permanent Injunction in favour of the plaintiff and against the defendants thereby restraining the defendants, their representatives, employees, agents etc. from dispossessing the plaintiff forcibly and illegally from the premises and also from interfering in the peaceful possession of the above said premises.

(b) award cost of the suit in favour of the Plaintiff and against the Defendants;

(c) pass such other and further order(s) as may be deemed fit and proper on the facts and in the circumstances of this case.

Plaintiff

Place:                                                        Through
Date:                                                         Advocate

VERIFICATION:
Verified at Delhi on this {{verificationDay}} of {{verificationMonth}} 20{{verificationYear}} that the contents of paras 1 to {{lastFactPara}} of the plaint are true to my knowledge, those of paras {{fromInfoPara}} to {{toInfoPara}} are true on information received and believed to be true and last para is the humble prayer to this Hon'ble Court.

Plaintiff

[NOTE: This plaint has to be supported by an affidavit]`;

export const TEMPLATE_TEMP_INJUNCTION_APPLICATION = `IN THE COURT OF SH. {{judgeName}} SENIOR CIVIL JUDGE (DISTRICT {{district}}), {{courtLocation}} COURT, DELHI

IA NO. {{iaNo}} OF {{year}} IN SUIT NO. {{suitNo}} OF {{year}}

IN THE MATTER OF:

{{plaintiffName}}                                             …PLAINTIFF/APPLICANT

VERSUS

{{defendant1Name}}                                            …DEFENDANT 1/RESPONDENT 1
{{defendant2Name}}                                            …DEFENDANT 2/RESPONDENT 2

APPLICATION FOR TEMPORARY INJUNCTION UNDER ORDER XXXIX, RULE 1 & 2 READ WITH SECTION 151 OF THE CODE OF CIVIL PROCEDURE, 1908

MOST RESPECTFULLY SHOWETH:

1. That the plaintiff has filed a suit for permanent injunction which is pending for disposal before this Hon'ble Court.

2. That the contents of the accompanying suit for permanent injunction may kindly be read as a part and parcel of this application which are not repeated here for the sake of brevity.

3. That the plaintiff/applicant has got a prima-facie case in his favour and there is likelihood of success in the present case.

4. That in case the defendants are not restrained by means of ad-interim injunction from dispossessing the plaintiff from the above said premises no. {{propertyNo}} and from interfering in physical peaceful possession of the above said premises, the plaintiff shall suffer irreparable loss and injury and the suit shall become anfractuous and would lead to multiplicity of the cases.

5. That the balance of convenience lies in favour of the plaintiff and against the defendants.

PRAYER: It is, therefore most respectfully prayed that this Hon'ble Court may be pleased to:

a) Pass ex-parte ad interim injunction restraining the defendants, their associates, servants, agents and their representatives from interfering into the peaceful physical possession of the plaintiff in the above said premises and from dispossessing the applicant/plaintiff from the same.

b) pass such other and further order(s) as may be deemed fit and proper on the facts and in the circumstances of this case.

Plaintiff/Applicant

Place:                                                        Through
Date:                                                         Advocate

[NOTE: This Application has to be supported by an affidavit].`;

export const TEMPLATE_SUIT_SPECIFIC_PERFORMANCE = `IN THE COURT OF {{court}} (DIST {{district}}), {{courtLocation}} COURT, DELHI
SUIT NO. {{suitNo}} OF {{year}}

IN THE MATTER OF:

{{plaintiffName}}
S/o {{plaintiffFatherName}}
R/o {{plaintiffAddress}}, New Delhi                           …PLAINTIFF

VERSUS

{{defendantName}}
S/o {{defendantFatherName}}
R/o {{defendantAddress}}, New Delhi                           …DEFENDANT

SUIT FOR SPECIFIC PERFORMANCE OF CONTRACT

MOST RESPECTFULLY SHOWETH:

1. That the plaintiff is a resident of {{plaintiffAddress}}.

2. That the defendant is the absolute owner of the property bearing no. {{propertyNo}} admeasuring {{propertyDescription}} (hereinafter referred to as the suit property).

3. That the plaintiff was in need of the property for {{purposeOfPurchase}} and came to know that the Defendant is interested in selling the suit property.

4. That the plaintiff approached the defendant for purchasing the suit property on {{initialApproachDate}} and the plaintiff and the defendant discussed the terms and conditions.

5. That on {{agreementDate}}, the plaintiff and the defendant entered into an agreement in writing whereby the defendant agreed to sell his property to the plaintiff for Rs. {{totalConsideration}}. The copy of the agreement is annexed as Annexure A.

6. That the plaintiff paid Rs. {{earnestMoney}} to the defendant as earnest money and it was decided that the balance of Rs. {{balanceAmount}} will be paid on {{balancePaymentDate}} and the sale deed will be executed and the possession of the suit property will be handed over to the plaintiff on the payment of the balance amount.

7. That on {{requestDate}}, the plaintiff approached the defendant and requested him to execute the sale deed along with handing over of the possession of the suit property to the plaintiff. However, the defendant refused to execute the sale deed.

8. That the plaintiff approached the defendant for execution of the sale deed on various occasions ({{additionalRequestDates}}), however, the defendant refused to execute the sale deed on one pretext or the other.

9. That the plaintiff finally issued a legal notice dated {{legalNoticeDate}} to the defendant calling upon the defendant to perform his part of the agreement by executing the sale deed and handing over the possession of the suit property to the plaintiff. However, the defendant failed to comply with his part of the agreement and did not reply to the legal notice.

10. That the plaintiff is ready and willing to perform his part of agreement by paying the balance amount.

11. That the cause of action arose on {{causeOfActionDate}} when the defendant agreed to sell the suit property to the plaintiff. The cause of action is still subsisting as the defendant has refused to perform his part of the agreement.

12. That the suit is within the period of limitation.

13. That this Hon'ble Court has jurisdiction to entertain this suit because the cause of action arose within the territorial jurisdiction of the court.

14. That the requisite court fees have been paid.

PRAYER:
It is, therefore most respectfully prayed that this Hon'ble Court may be pleased to:

a. pass a decree of specific performance of the agreement in favour of the plaintiff and against the defendant directing the defendant to execute the sale deed and hand over the possession of the suit property to the plaintiff,

b. award cost of the suit in favour of the plaintiff and against the defendant; and

c. pass such other and further order(s) as may be deemed fit and proper on the facts and in the circumstances of this case.

Plaintiff

Place:                                                        Through
Date:                                                         Advocate

VERIFICATION:
Verified at Delhi on this {{verificationDay}} day of {{verificationMonth}} 20{{verificationYear}} that the contents of paras 1 to {{lastFactPara}} of the plaint are true to my knowledge derived from the records of the Plaintiff maintained in the ordinary course of its business, those of paras {{fromInfoPara}} to 14 are true on information received and believed to be true and last para is the humble prayer to this Hon'ble Court.

Plaintiff

[NOTE: The above plaint must be supported by an Affidavit]`;

export const TEMPLATE_WRITTEN_STATEMENT = `IN THE COURT OF SHRI {{court}} CIVIL JUDGE (DISTRICT {{district}}), {{courtLocation}} COURT, DELHI
SUIT NO. {{suitNo}} OF {{year}}

{{plaintiffName}}                                             …PLAINTIFF

VERSUS

{{defendantName}}                                             …DEFENDANT

WRITTEN STATEMENT ON BEHALF OF THE DEFENDANT

MOST RESPECTFULLY SHOWETH:

PRELIMINARY OBJECTIONS:

1. That the suit is barred by limitation under Article {{limitationArticle}} of the Limitation Act and is liable to be dismissed on this ground alone.

2. That this Hon'ble Court has no jurisdiction to entertain and try this suit because {{jurisdictionObjection}}.

3. That the suit has not been properly valued for the purpose of court fees and jurisdiction and is therefore liable to be rejected outrightly.

4. That there is absolutely no cause of action in favour of the Plaintiff and against the Defendant. The suit is therefore liable to be rejected on this ground also.

5. That the suit is bad for non-joinder of necessary parties, namely {{missingParties}}.

6. {{additionalPreliminaryObjection}}

7. {{furtherPreliminaryObjection}}

ON MERITS:

Without prejudice to the preliminary objections stated above, the reply on merits, which is without prejudice to one another, is as under:

1. That the contents of para 1 of the plaint is correct and is admitted.

2. That the contents of para 2 of the plaint are denied for want of knowledge. The Plaintiff be put to the strict proof of each and every allegation made in the para under reply.

3. That the contents of para 3 of the plaint are absolutely incorrect and are denied. It is specifically denied that the Plaintiff is the owner of the suit property. {{para3Merits}}

4. That with respect to para 4 of the plaint, {{para4Merits}}

5. {{para5Merits}}

6. {{para6Merits}}

7. {{para7Merits}}

{{additionalMeritsParas}}

PRAYER:
It is, therefore most respectfully prayed that this Hon'ble Court may be pleased to:

a) Dismiss the suit of the plaintiff.

b) Award costs to the defendant.

c) Pass any other just and equitable order as deemed fit in the interest of justice.

DEFENDANT

Delhi                                                         THROUGH
Dated                                                         ADVOCATE

VERIFICATION:
Verified at Delhi on {{verificationDay}} day of {{verificationMonth}}, 20{{verificationYear}} that the contents of paras 1 to {{lastPrelimPara}} of the preliminary objection and para {{fromMeritsPara}} to {{toMeritsPara}} of reply on merits are true to my personal knowledge and those of paras {{fromPrelimInfo}} to {{toPrelimInfo}} of preliminary objection and para {{fromMeritsInfo}} to {{toMeritsInfo}} of reply on merits are true & correct on the basis of legal advice received and believed to be true. Last para is prayer to the Hon'ble Court.

DEFENDANT

[NOTE: Counter Claim, Set off can be joined in the Written Statement and the same may be verified and supported by affidavit]`;

// ─── MATRIMONIAL PLEADINGS ────────────────────────────────────────────────────

export const TEMPLATE_RESTITUTION_CONJUGAL_RIGHTS = `IN THE COURT OF PRINCIPAL JUDGE, {{courtLocation}} COURT, FAMILY COURT (DISTRICT {{district}}), DELHI

HMA PETITION NO. {{petitionNo}} OF {{year}}

IN THE MATTER OF:

{{petitionerName}}
S/o {{petitionerFatherName}}
R/o {{petitionerAddress}}                                     …PETITIONER

VERSUS

{{respondentName}}
W/o {{petitionerName}}
R/o {{respondentAddress}}                                     …RESPONDENT

PETITION FOR RESTITUTION OF CONJUGAL RIGHTS UNDER SECTION 9 OF THE HINDU MARRIAGE ACT, 1955

Most Respectfully Showeth:

1. That a marriage was solemnized between the parties according to Hindu rites and ceremonies on {{marriageDate}} at {{marriagePlace}}. The said marriage is registered with the Registrar of marriage. A certified copy of the relevant extract from the Hindu Marriage Register {{registrationNo}} is filed herewith. An affidavit, duly attested declaring and affirming these facts is also attached.

2. That the status and place of residence of the parties to the marriage before the marriage and at the time of filing the petition are as follows:

                Husband                         Wife
         Status    Age   Place of         Status    Age   Place of
                         Residence                        Residence
(i) Before 
    marriage:  {{husbandStatusBefore}}          {{wifeStatusBefore}}

(ii) At time of
    petition:  {{husbandStatusNow}}             {{wifeStatusNow}}

3. That {{childrenDetails}}

4. That the respondent has, without reasonable excuse, withdrawn from the society of the petitioner with effect from {{withdrawalDate}}. {{circumstancesOfWithdrawal}}

5. That the petition is not presented in collusion with the respondent.

6. That there has not been any unnecessary or improper delay in filing the petition.

7. That there is no other legal ground why relief should not be granted.

8. That there have not been any previous proceedings with regard to the marriage by or on behalf of any party.

9. That the marriage was solemnized at {{marriagePlace}}. The parties last resided together at {{lastResidenceTogether}}. The parties are now residing at {{currentResidence}} (within the local limit of the ordinary original jurisdiction of this Court).

10. That this Hon'ble Court has jurisdiction to try and entertain this petition.

11. That the requisite court fee of Rs. {{courtFee}} has been affixed on this petition.

PRAYER:

In view of the above facts and circumstances, it is, therefore, most respectfully and humbly prayed that this Hon'ble Court may be pleased to grant a decree of restitution of conjugal rights under Section 9 of the Hindu Marriage Act in favour of the petitioner.

Any other relief/order/Direction this Hon'ble Court may deem fit in the interest of justice and equity.

PETITIONER

Through

Place: Delhi
Date:                                                         ADVOCATE

VERIFICATION:
The above named petitioner states on solemn affirmation that paras 1 to {{lastKnowledgePara}} of the petition are true to the petitioner's knowledge and paras {{fromInfoPara}} to {{toInfoPara}} are true to the petitioner's information received and believed to be true by him/her.

Verified at {{verificationPlace}} (Place) Dated {{verificationDate}}

PETITIONER

[NOTE: AN AFFIDAVIT OF PETITIONER IS TO BE APPENDED]`;

export const TEMPLATE_DIVORCE_S13 = `IN THE COURT OF PRINCIPAL JUDGE, FAMILY COURT (DISTRICT {{district}}), {{courtLocation}} COURT, DELHI

HMA PETITION NO. {{petitionNo}} OF {{year}}

IN THE MATTER OF:

{{petitionerName}}
S/o {{petitionerFatherName}}
R/o {{petitionerAddress}}                                     …PETITIONER

VERSUS

{{respondentName}}
W/o {{petitionerName}}
R/o {{respondentAddress}}                                     …RESPONDENT

PETITION FOR DISSOLUTION OF MARRIAGE BY A DECREE OF DIVORCE UNDER SECTION 13 OF THE HINDU MARRIAGE ACT, 1955

Most Respectfully Showeth:

1. That the marriage was solemnized between the parties according to Hindu rites and ceremonies after the commencement of the Hindu Marriage Act on {{marriageDate}} at {{marriagePlace}}. The said marriage is registered with the Registrar of marriage. A certified copy of the relevant extract from the Hindu Marriage Register {{registrationNo}} is filed herewith.

2. That the status and place of residence of the parties to the marriage before the marriage and at the time of filing the petition are as follows:

                Husband                         Wife
         Status    Age   Place of         Status    Age   Place of
                         Residence                        Residence
(i) Before marriage:  {{husbandStatusBefore}}       {{wifeStatusBefore}}

(ii) At time of petition:  {{husbandStatusNow}}     {{wifeStatusNow}}

3. {{childrenDetails}}

4. That the respondent {{groundForDivorce}}. {{factsInSupport}}

5. {{connivanceOrCondonation}}

6. {{crueltyCondonation}}

7. That the petition is not presented in collusion with the respondent.

8. That there has not been any unnecessary or improper delay in filing the petition.

9. That there is no other legal ground why relief should not be granted.

10. That there have not been any previous proceedings with regard to the marriage by or on behalf of any party.

11. That the marriage was solemnized at {{marriagePlace}}. The parties last resided together at {{lastResidenceTogether}}. The parties are now residing at {{currentResidence}} (within the local limits of the ordinary original jurisdiction of this Court).

12. That this Hon'ble Court has jurisdiction to try and entertain this petition.

13. That the requisite court fee of Rs. {{courtFee}} has been affixed on this petition.

PRAYER:

In view of the above facts and circumstances, it is, therefore, most respectfully and humbly prayed that this Hon'ble Court may be pleased to grant a decree of divorce under Section 13 of HMA in favor of petitioner.

Any other relief/order/Direction this Hon'ble Court may deem fit in the interest of justice and equity.

PETITIONER

THROUGH

ADVOCATE

VERIFICATION:
The above-named petitioner states on solemn affirmation that paras 1 to {{lastKnowledgePara}} of the petition are true to the petitioner's knowledge and paras {{fromInfoPara}} to {{toInfoPara}} are true to the petitioner's information received and believed to be true by him/her.

Verified at {{verificationPlace}} (Place) Dated {{verificationDate}}

PETITIONER

[Note: An affidavit of the petitioner is to be appended.]`;

export const TEMPLATE_DIVORCE_MUTUAL_CONSENT = `IN THE COURT OF PRINCIPAL JUDGE, FAMILY COURT (DISTRICT {{district}}), {{courtLocation}} COURT, DELHI

HMA PETITION NO. {{petitionNo}} OF {{year}}

IN THE MATTER OF:

{{petitioner1Name}}                                           …PETITIONER NO. 1

AND

{{petitioner2Name}}                                           …PETITIONER NO. 2

PETITION FOR DISSOLUTION OF MARRIAGE BY A DECREE OF DIVORCE BY MUTUAL CONSENT UNDER SECTION 13-B(1) OF THE HINDU MARRIAGE ACT, 1955

Most Respectfully Showeth:

1. That the marriage was solemnized between the parties according to Hindu rites and ceremonies on {{marriageDate}} at {{marriagePlace}}. The said marriage is registered with the Registrar of marriage.

2. That the status and place of residence of the parties before and at the time of filing the petition are as follows:

                Husband                         Wife
         Status    Age   Place of         Status    Age   Place of
                         Residence                        Residence
(i) Before marriage: {{husbandStatusBefore}}        {{wifeStatusBefore}}
(ii) At time of petition: {{husbandStatusNow}}       {{wifeStatusNow}}

3. {{childrenDetails}}

4. That the parties have been living separately for a period of more than one year before the date of this petition, and they have not been able to live together. They have mutually agreed that the marriage should be dissolved.

5. That the petitioners have made arrangements with respect to the following:
   (a) Maintenance/Alimony: {{maintenanceArrangement}}
   (b) Custody of children: {{custodyArrangement}}
   (c) Return of Stridhan/Dowry: {{stridhanArrangement}}

6. That the petition is not presented in collusion or under any coercion, undue influence, or fraud.

7. That the marriage was solemnized at {{marriagePlace}}. The parties last resided together at {{lastResidenceTogether}}. Both parties are now residing within the jurisdiction of this Court.

8. That this Hon'ble Court has jurisdiction to try and entertain this petition.

9. That the requisite court fee of Rs. {{courtFee}} has been affixed on this petition.

PRAYER:

In view of the above facts and circumstances, it is, therefore, most respectfully and humbly prayed that this Hon'ble Court may be pleased to grant a decree of divorce by mutual consent under Section 13-B of the Hindu Marriage Act, 1955 in favour of both the petitioners.

Any other relief/order/Direction this Hon'ble Court may deem fit in the interest of justice and equity.

PETITIONER NO. 1                                              PETITIONER NO. 2

THROUGH ADVOCATE

VERIFICATION:
The above-named petitioners state on solemn affirmation that the contents of this petition are true to their knowledge and belief.

Verified at {{verificationPlace}} (Place) Dated {{verificationDate}}

[Note: Affidavits of both petitioners are to be appended.]`;

// ─── CONSUMER COMPLAINT ───────────────────────────────────────────────────────

export const TEMPLATE_CONSUMER_COMPLAINT = `BEFORE THE DISTRICT CONSUMER DISPUTES REDRESSAL COMMISSION (DISTRICT {{district}}), DELHI
CONSUMER COMPLAINT NO. {{complaintNo}} OF {{year}}

IN THE MATTER OF:

{{complainantName}}
S/o Shri {{complainantFatherName}}
R/o {{complainantAddress}}                                    …COMPLAINANT

VERSUS

1. {{oppParty1Name}}                                          …OPPOSITE PARTY NO. 1
2. {{oppParty2Name}}                                          …OPPOSITE PARTY NO. 2

COMPLAINT UNDER SECTION 35 OF THE CONSUMER PROTECTION ACT, 2019

MOST RESPECTFULLY SHOWETH:

1. That the Complainant is {{complainantDescription}}.

2. That {{deficiencyEvent1}}.

3. That {{complainantActionTaken1}}.

4. That {{deficiencyEvent2}}.

5. That {{deficiencyEvent3}}.

6. That on account of dereliction of duty and negligence on part of the opposite parties the complainant suffered loss and injury due to deprivation, harassment, mental agony and loss of {{lossType}} and for which he is entitled to compensation and refund of excess amount charged by the department.

7. That the complainant sent a notice to each of the opposite parties by registered post asking them to pay him a sum of Rs. {{noticeAmount}} along with interest thereon till date of the actual payment to which none of them responded.

8. That in the interest of justice the complainant should be paid by the opposite parties as under:
   (1) Compensation of Rs. {{compensationAmount}} for the deficiency in services and loss and injury caused to the complainant due to negligence and dereliction of duty on the part of the opposite parties.
   (2) Payment of Rs. {{refundAmount}} along with interest @ {{interestRate}} % p.a. till the date of actual payment.
   (3) Cost of these proceedings.

9. That the cause of action arose on {{causeOfActionDate}} when {{causeOfActionFacts}}.

10. That for the purposes of Section {{jurisdictionSection}} of the Act, the compensation claimed by the complainant is below Rs. {{claimAmount}}, so this Commission has jurisdiction to determine and adjudicate upon this consumer dispute.

11. That in the interest of justice the claims of compensation and refund should be allowed.

PRAYER:

It is, therefore most respectfully prayed that this Hon'ble Commission may be pleased to:

(a) award compensation of Rs. {{compensationAmount}} (for deficiency in services);

(b) award compensation of Rs. {{harassmentCompensation}} (for mental harassment);

(c) award cost of the suit in favour of the Complainant and against the Opposite Party; and

(d) pass such other and further order(s) as may be deemed fit and proper on the facts and in the circumstances of this case.

Complainant

Date:                                                         Through
Place:                                                        Advocate

Note: An affidavit in support to be annexed.`;

// ─── CONSTITUTIONAL LAW ───────────────────────────────────────────────────────

export const TEMPLATE_WRIT_PETITION_HC = `IN THE HIGH COURT OF {{highCourtName}} AT {{highCourtCity}}

WRIT PETITION (CIVIL/CRIMINAL) NO. {{wpNo}} OF {{year}}

IN THE MATTER OF:

{{petitionerName}}
S/o {{petitionerFatherName}}
R/o {{petitionerAddress}}                                     …PETITIONER

VERSUS

1. {{respondent1Name}}                                        …RESPONDENT NO. 1
2. {{respondent2Name}}                                        …RESPONDENT NO. 2

WRIT PETITION UNDER ARTICLE 226 OF THE CONSTITUTION OF INDIA

MOST RESPECTFULLY SHOWETH:

1. That the petitioner is a citizen of India residing at {{petitionerAddress}}.

2. BRIEF FACTS OF THE CASE:

{{briefFacts}}

3. GROUNDS:

The petitioner approaches this Hon'ble Court on the following grounds:

(a) {{ground1}}

(b) {{ground2}}

(c) {{ground3}}

(d) {{ground4}}

(e) {{ground5}}

4. That the petitioner has no other equally efficacious alternative remedy. The Writ Petition filed is, therefore, maintainable.

5. That the impugned {{impugnedAct}} is ex-facie illegal, without jurisdiction and contrary to the provisions of law, and is therefore liable to be quashed.

6. That the petitioner has not filed any similar petition before this or any other Court.

7. That the requisite court fee has been paid.

PRAYER:

It is, therefore, most respectfully prayed that this Hon'ble Court may be pleased to:

(a) Issue a writ of {{writType}} or any other appropriate writ, order or direction thereby {{writRelief}};

(b) Issue appropriate directions to the respondents {{specificDirections}};

(c) award cost of the petition in favour of the Petitioner and against the Respondents; and

(d) pass such other and further order(s) as may be deemed fit and proper on the facts and in the circumstances of this case.

PETITIONER

Place:                                                        THROUGH
Date:                                                         ADVOCATE

[NOTE: To be supported by an affidavit]`;

// ─── OTHER CRIMINAL ────────────────────────────────────────────────────────────

export const TEMPLATE_CHEQUE_BOUNCE_COMPLAINT = `IN THE COURT OF JUDICIAL MAGISTRATE FIRST CLASS (NI ACT), {{courtLocation}} COURT, (DISTRICT {{district}}), DELHI

CRIMINAL COMPLAINT NO. {{complaintNo}} OF {{year}}

{{complainantName}}
S/o {{complainantFatherName}}
R/o {{complainantAddress}}                                    …COMPLAINANT

VERSUS

{{accusedName}}
S/o {{accusedFatherName}}
R/o {{accusedAddress}}                                        …ACCUSED

JURISDICTION: P.S. {{policeStation}}

COMPLAINT UNDER SECTION 138 OF THE NEGOTIABLE INSTRUMENTS ACT, 1881

MOST RESPECTFULLY SHOWETH:

1. That the Complainant is {{complainantDescription}}.

2. That the accused is {{relationshipWithComplainant}} of the Complainant in respect of {{businessRelationship}}.

3. That on {{chequeDate}} the accused handed over cheque bearing No. {{chequeNo}} dated {{chequeDateOnCheque}} for Rs. {{chequeAmount}} drawn on {{bankName}}, {{bankBranch}} to the complainant towards {{purposeOfCheque}}. The said original cheque is annexed hereto as Annexure – B.

4. That the Complainant deposited the said cheque in his account with the {{complainantBankName}} on {{depositDate}} but the same was dishonoured on presentation with the remarks '{{dishonourRemarks}}'. The original returning memo dated {{returnMemoDate}} in respect of the said cheque is annexed hereto as Annexure – 'C'.

5. That vide letter dated {{demandNoticeDate}}, the Complainant called upon the accused to make the payment of the amount covered by the dishonoured cheque. The said letter was sent to the accused by Regd. A.D. as well as U.P.C. However, the accused failed to make the payment of the amount in question to the Complainant within fifteen days of the receipt of the said notice.

6. That the cheque in question was returned unpaid because the amount standing to the credit in the Accused's account was insufficient to honour the cheque in question and as such the Accused is liable to be prosecuted and punished under Section 138 of the Negotiable Instruments Act, 1881 as amended upto-date.

7. That the Complainant has complied with all the requirements of Section 138 of the Negotiable Instruments Act, 1881 as amended upto-date namely the cheque in question was presented on {{depositDate}} i.e. within the period of its validity, the demand for payment was made to the Accused on {{demandNoticeDate}} i.e. within thirty days of the date of receipt of information regarding the dishonouring of the cheque. True copy of the said demand dated {{demandNoticeDate}} is annexed hereto as Annexure – 'D'. The postal receipt and the U.P.C. thereof are annexed hereto as Annexure-E collectively. The accused failed to make the payment within fifteen days of the said notice and as such the Complainant has approached this Hon'ble court within one month of the date of the cause of action. The Complaint is therefore within time.

8. That the Hon'ble Court has jurisdiction to entertain and try the present complaint because the offence is committed within the jurisdiction of this Hon'ble Court. {{jurisdictionFacts}}

PRAYER:

It is, therefore most respectfully prayed that this Hon'ble Court may be pleased to summon the accused under Section 138 of the Negotiable Instruments Act, 1881 as amended upto-date and the accused be tried and punished in accordance with law for the aforesaid offence committed by him.

COMPLAINANT

Place:                                                        THROUGH
Date:                                                         ADVOCATE

Note: An affidavit in support to be annexed.`;

export const TEMPLATE_CONTEMPT_PETITION = `IN THE HIGH COURT OF DELHI AT NEW DELHI
CONTEMPT PETITION NO. {{cpNo}} OF {{year}}
IN {{baseCase}}

IN THE MATTER OF:

1. {{petitioner1Name}}
   S/o {{petitioner1FatherName}}
   R/o {{petitioner1Address}}, New Delhi

2. {{petitioner2Name}}
   W/o {{petitioner2FatherName}}
   R/o {{petitioner2Address}}, New Delhi                      …PETITIONERS

VERSUS

1. {{respondent1Name}}                                        …RESPONDENT NO. 1
2. {{respondent2Name}}                                        …RESPONDENT NO. 2
3. {{respondent3Name}}                                        …RESPONDENT NO. 3

CONTEMPT PETITION UNDER SECTIONS 11, 12 OF THE CONTEMPT OF COURTS ACT, 1971

MOST RESPECTFULLY SHOWETH:

1. That {{petitionerDescription}} filed {{baseCase}} in the High Court of Delhi at New Delhi. The respondents in the said petition were {{baseRespondents}}. The said petition is still pending and awaiting final disposal.

2. That the Hon'ble court on {{orderDate}} issued notice to the respondents and granted status quo/stay order thereby restraining the respondents from {{restrainedAction}}. The copy of the orders are annexed herein as Annexure A-1.

3. {{backgroundFacts}}

4. That the respondent {{contemner}} had been conducting {{violationDescription}} in the said area on {{violationDate}} and despite being made aware of the court orders, the contemner deliberately violated the said orders.

5. That {{additionalViolationFacts}}

6. That as detailed above, by not complying with the said orders of the Hon'ble Court, the respondent has committed the contempt of court.

7. The cause of action in the present petition arose when the respondents were apprised of the court orders and the concerned officers refused to comply with the orders of the court. The cause of action is still continuing.

PRAYER:

It is therefore most respectfully prayed that the Hon'ble Court may be pleased to initiate contempt proceedings against the above named contemners. It is further prayed that the Hon'ble Court may be pleased to pass such further orders/directions as it may deem fit and proper.

Petitioner

Date:                                                         Through
Place:                                                        Advocate

[Note: The petition must be supported by an affidavit].`;

export const TEMPLATE_DOMESTIC_VIOLENCE_PETITION = `IN THE COURT OF CHIEF JUDICIAL MAGISTRATE, {{courtLocation}} COURT (DISTRICT {{district}}), DELHI
COMPLAINT NO. {{complaintNo}} OF {{year}}
U/S 12 OF DOMESTIC VIOLENCE ACT

IN THE MATTER OF:

Smt. {{complainantName}}
W/o Late Sh. {{deceasedHusbandName}}
R/o {{complainantAddress}}                                    …Complainant

VERSUS

Sh. {{respondentName}}
S/o {{respondentFatherName}}
R/o {{respondentAddress}}                                     …Respondent

Police Station: {{policeStation}}

COMPLAINT UNDER SECTION 12 OF THE PROTECTION OF WOMEN FROM DOMESTIC VIOLENCE ACT, 2005

Most Respectfully Showeth:

1. That the Respondent is the {{respondentRelation}} of the Complainant who is harassing and torturing the Complainant by illegal act of violence in order to throw her out of the matrimonial home.

2. That the Complainant was married to {{husbandName}} on {{marriageDate}} as per {{marriageRites}} rites and ceremonies and thereafter started living in the matrimonial home as a joint family along with the Respondent and that out of the wedlock following children were born who are in the care and custody of the complainant. The husband of the complainant died on {{husbandDeathDate}} due to {{causeOfDeath}}.

3. That before his death {{husbandName}} was engaged in {{husbandBusiness}} and was having {{businessDescription}}.

4. That after the death of the husband of the complainant, the Respondent started harassing and torturing the complainant and her children by {{actOfViolence}}.

5. That on {{violenceDate1}}, the Respondent {{violenceIncident1}}.

6. That on {{violenceDate2}}, the Respondent {{violenceIncident2}}.

7. That the Complainant has suffered {{sufferedConsequences}} on account of the acts of domestic violence of the Respondent.

8. That the Complainant does not have any independent means of livelihood and is dependent on {{dependencyDescription}}.

9. That the Complainant has approached the Protection Officer who was unable to resolve the matter.

10. That the Complainant is residing within the jurisdiction of this Court and hence this Court has the jurisdiction to try and entertain this complaint.

PRAYER:

It is, therefore, most respectfully prayed that this Hon'ble Court may be pleased to:

(a) Pass a Protection Order restraining the Respondent from committing any act of domestic violence against the Complainant and her children;

(b) Pass a Residence Order directing the Respondent not to disturb the Complainant's right to reside in the shared household;

(c) Pass a Monetary Relief Order directing the Respondent to pay Rs. {{monetaryRelief}} per month as maintenance to the Complainant;

(d) Pass a Custody Order granting custody of the children to the Complainant;

(e) Pass such other and further order(s) as may be deemed fit and proper on the facts and in the circumstances of this case.

Complainant

Place:                                                        Through
Date:                                                         Advocate

[Note: An affidavit in support to be attached]`;

// ─── CONVEYANCING ──────────────────────────────────────────────────────────────

export const TEMPLATE_WILL = `THIS IS THE LAST WILL TESTAMENT of me, {{testatorName}} S/o Sh. {{testatorFatherName}} R/O {{testatorAddress}} made at {{executionPlace}} on {{executionDate}}. That life is uncertain and this is my last Will by way of which I bequeath voluntarily and out of my own free will in a sound state of mind, my self acquired properties to the beneficiaries as described hereunder.

WHEREAS I was married to {{spouseName}} on {{marriageDate}} and is living happily for {{yearsOfMarriage}} years and out of the wedlock we have {{numberOfChildren}} children, {{childrenDetails}}.

In my lifetime I have built my movable and immovable properties out of my own sources and, therefore, I am the absolute owner of the properties hereunder.

IMMOVABLE PROPERTY
1. Residential property bearing no. {{property1No}} admeasuring {{property1Area}}.
2. {{property2Details}}
(hereinafter called the Immovable Property)

MOVABLE PROPERTY
{{movablePropertyDetails}}
(hereinafter called the Movable Property)

I HEREBY WISH that my abovementioned property should devolve in the following manner:

That my property bearing no. {{property1No}} would devolve on to my {{beneficiary1Relation}} {{beneficiary1Name}} absolutely and unconditionally and {{beneficiary1Instructions}}.

That my property bearing no. {{property2No}} and my all movable property would devolve on to my {{beneficiary2Relation}} {{beneficiary2Name}} absolutely and unconditionally and none of my legal heirs shall have any claims on this property whatsoever.

{{additionalBequests}}

That my present will is drafted in my presence and upon my instructions and contents of my will have been read out to me in my own vernacular.

I declare the contents of this Will to be my last Will arrived at by me in sound state of mind.

IN WITNESSES WHEREOF I {{testatorName}} have signed this will hereunder on this {{signatureDay}} Day of {{signatureMonth}}, 20{{signatureYear}} at {{signaturePlace}} in the presence of the following witnesses who are also attesting this will in my presence and at my request.

Sign

TESTATOR

Signed by the above named testator in our presence at the same time and each of us has in the presence of the testator signed our name hereunder as an attesting witness

1. {{witness1Name}}, {{witness1Address}}        Sign
2. {{witness2Name}}, {{witness2Address}}        Sign`;

export const TEMPLATE_AGREEMENT_TO_SELL = `THIS AGREEMENT is made at {{executionPlace}} on this {{executionDay}} day of {{executionMonth}} {{executionYear}}

BETWEEN

Mr. {{vendorName}} aged {{vendorAge}} s/o {{vendorFatherName}} r/o {{vendorAddress}} (hereinafter referred to as the VENDOR which expression shall, unless repugnant to the context or meaning thereof shall mean and include his heirs, executors, administrators and assigns of the FIRST PART).

AND

Mr. {{vendeeName}} aged {{vendeeAge}} s/o {{vendeeFatherName}} r/o {{vendeeAddress}} (hereinafter referred to as the VENDEE/PURCHASER which expression shall, unless repugnant to the context or meaning thereof shall mean and include his heirs, executors, administrators and assigns of the SECOND PART).

WHEREAS the Vendor is the absolute owner of the property bearing no. {{propertyNo}} admeasuring {{propertyArea}} situated at {{propertyAddress}} (hereinafter referred to as the said property).

AND WHEREAS the Vendor has agreed to sell the said property to the Vendee at the price and on the conditions mentioned hereinafter.

NOW IT IS AGREED BETWEEN THE PARTIES AS FOLLOWS:

1. The Vendor hereby agrees to sell, transfer and convey the said property in favour of the Vendee.

2. That the consideration of Rs. {{totalConsideration}} is to be paid by the Vendee to the Vendor. Rs. {{earnestMoney}} is to be paid at the execution of this agreement as earnest money. Rs. {{secondInstalment}} on {{secondInstalmentDate}} and lastly Rs. {{finalPayment}} at the time of final sale deed.

3. The Vendor acknowledges the payment of Rs. {{earnestMoney}} as earnest money paid in cash/cheque/DD no. {{paymentInstrumentNo}} drawn on {{paymentBank}} by Vendee.

4. The Vendor shall make out a marketable title of the said property free from encumbrances and reasonable doubts.

5. The Vendor shall deliver to the Vendee the title deeds relating to the said property in his possession and power on execution of these presents for inspection and investigation of the title by the Vendee or his advocate.

6. The Vendor agrees to apply for, obtain and furnish unto the Vendee all such permissions as may be necessary under the laws for registration of Sale Deed.

7. The Vendor and the Vendee hereby agree that the sale will be completed within {{completionPeriod}} from the date hereof.

8. All the taxes, levies etc due and payable against the said property shall be paid by the Vendor till the completion of sale and thereafter it will be the responsibility of the purchaser. The Vendor shall handover all the tax receipts etc. duly paid to the Vendee at the time of completion of sale.

9. The Vendor agrees to handover actual, physical and vacant possession of the said property unto the Vendee at the time of sale deed.

10. That the expenses towards the payment of stamp duty, registration charges and all other incidental expenses for agreement for sale and sale deed shall be borne out by the Vendee.

11. If the Vendor fails to make out the clear marketable title to the said property as aforesaid then the Vendee will have the right to cancel this agreement by giving atleast fifteen days notice to the Vendor and after the expiration of fifteen days the agreement shall stand terminated and the Vendor agrees to return the earnest money to the Vendee.

12. If the Vendee fails to perform his obligations under this agreement within the time stipulated then the Vendor shall be entitled to cancel this agreement by giving atleast fifteen days notice in writing to the Vendee. On termination the Vendor will be entitled to forfeit the earnest money paid by the Vendee.

SCHEDULE OF PROPERTY

{{propertySchedule}}

IN WITNESS WHEREOF parties hereunto have signed this document on the date and place first above written in the presence of following witnesses.

VENDOR

VENDEE

WITNESSES:
(1) {{witness1Name}}
(2) {{witness2Name}}`;

export const TEMPLATE_SALE_DEED = `THIS SALE DEED is made at {{executionPlace}} on this {{executionDay}} day of {{executionMonth}} {{executionYear}}

BETWEEN

Mr. {{vendorName}} aged {{vendorAge}} s/o {{vendorFatherName}} r/o {{vendorAddress}} (hereinafter referred to as the VENDOR which expression shall, unless repugnant to the context or meaning thereof shall mean and include his heirs, executors, administrators and assigns of the FIRST PART).

AND

Mr. {{vendeeName}} aged {{vendeeAge}} s/o {{vendeeFatherName}} r/o {{vendeeAddress}} (hereinafter referred to as the VENDEE/PURCHASER which expression shall, unless repugnant to the context or meaning thereof shall mean and include his heirs, executors, administrators and assigns of the SECOND PART).

WHEREAS the vendor purchased a freehold {{propertyType}} property measuring {{propertyArea}} and bearing No. {{propertyNo}} in {{propertyLocality}}, {{propertyCity}} vide sale deed dated {{priorSaleDeedDate}} registered in the office of the Sub-Registrar, {{registrationOffice}} as document No. {{docNo}} Addl. Book No. I, Vol. No. {{volNo}} at pages {{pages}} on {{registrationDate}}.

The aforementioned plot is bounded as under:
EAST  : {{eastBoundary}}
NORTH : {{northBoundary}}
WEST  : {{westBoundary}}
SOUTH : {{southBoundary}}

AND WHEREAS the Vendor after purchasing the said plot, got the building plan sanctioned from the Municipal Corporation of {{city}} vide their letter/file No. {{buildingPlanNo}} dated {{buildingPlanDate}}.

AND WHEREAS the Vendor has agreed to sell and the Vendee has agreed to purchase {{propertyDescription}} for a total consideration of Rs. {{totalConsideration}} on the terms and conditions set forth hereinafter.

NOW THIS SALE DEED WITNESSES AS FOLLOWS:

1. That in pursuance of this agreement, the Vendor has already received from the Vendee a sum of Rs. {{advanceAmount}} as part sale consideration, the receipt of which the Vendor hereby admits and acknowledges.

2. The balance amount of Rs. {{balanceAmount}} has been paid by the Vendee to the Vendor by cheque No. {{chequeNo}} dated {{chequeDate}} drawn on {{bankName}} ({{bankBranch}}).

3. That in view of the amount of sale consideration received, the Vendor hereby grants, conveys and transfers all his rights, titles and interests as held on the date hereof in the said property, together with undivided, indivisible and impartible proportionate ownership rights on the land underneath the said building.

4. That the Vendor is free to sell the remaining portion(s) of the said residential building to any other party/parties with common rights for use of common entrances, common passages, staircases, water tanks, common facilities etc. and the Vendee will not make any objection thereto.

5. That the Vendor assures that the sale of the said property is free from attachment, tenancies, gifts, decree, prior sale and religious disputes.

6. That the Vendee has perused the original title deed, sanctioned plans, sale plans etc. and has fully satisfied himself.

7. That all expenses of registration, Corporation tax etc. have been borne and paid by the Vendee.

8. That all taxes from the date of the Agreement to sell the said portion shall be borne and paid by the Vendee.

9. That the Vendee shall keep the said property in properly repaired and good condition and shall not do anything or omit to do anything which may endanger or affect the other portions of the said building.

10. That this transaction has taken place at {{transactionPlace}}. As such {{transactionPlace}} Court shall have exclusive jurisdiction to entertain any dispute arising out of or in any way touching or concerning this deed.

SCHEDULE OF PROPERTY

{{propertySchedule}}

IN WITNESS WHEREOF parties hereunto have signed this document on the date and place first above written in the presence of following witnesses.

VENDOR

VENDEE

WITNESSES:
(1) {{witness1Name}}
(2) {{witness2Name}}`;

export const TEMPLATE_GENERAL_POA = `KNOW ALL MEN BY THESE PRESENTS THAT THIS GENERAL POWER OF ATTORNEY is executed at {{executionPlace}} on this {{executionDay}} day of {{executionMonth}} 20{{executionYear}} by {{principalName}}, {{principalDescription}} having its registered office at {{principalAddress}} through its {{principalRepresentativeDesignation}} {{principalRepresentativeName}} (hereinafter referred to as the EXECUTANT), DO HEREBY APPOINT, NOMINATE, CONSTITUTE AND AUTHORISE {{attorneyName}}, {{attorneyDescription}}, {{attorneyAddress}} (hereinafter referred to as the ATTORNEY) AS MY TRUE AND LAWFUL ATTORNEY TO MANAGE, CONTROL, LOOKAFTER / SUPERVISE, PERFORM ALL LEGAL ACTS MENTIONED HEREUNDER.

WHEREAS {{recital1}}

AND WHEREAS {{recital2}}

NOW THIS GENERAL POWER OF ATTORNEY WITNESSESTH AS UNDER:

(i) To institute, commence and conduct any action, suit or other legal proceedings before any Court, Arbitrator, Quasi-judicial or authorities, Offices, Tribunals, Labour Courts, Conciliation Officers, Land Acquisition Officers, etc. on behalf of the {{principalName}} for claiming any right, relief, recovery, title, interest, property or in respect of any matter connected with or arising out of the business and subject to aforesaid, to settle, adjust, compromise or submit to Arbitration any such actions, suits or proceedings.

(ii) To defend all actions, suits, proceedings, applications, petitions, appeals, revisions, reviews, arbitrations, conciliations, taxation and labour matters and other disputes that are now pending or may hereafter be brought or made or instituted in any Court or office or Tribunal, Arbitrator, Conciliation Officer, or any other Judicial or Quasi-judicial authorities.

(iii) To appear and represent the {{principalName}} in any Court of Justice or Tribunal whatsoever and for the purpose aforesaid or any of them to sign and verify plaints, written statements, applications and swear affidavits and to sign petitions and other necessary documents including Vakalatnama and to appoint any Solicitor, Advocate, Pleader or other Legal Advisor with the necessary power.

(iv) To continue and conduct or defend any appeal, review, revision, arbitration in any Court or Tribunal or office against any order, judgment or decree made in suits, actions, proceedings, application etc.

(v) Generally for and in the name and as the act and deed of the {{principalName}} to make, execute and do all and every such further and other acts, Deeds, matters and things as shall be fit, requisite and necessary in and about the premises and for all or any of the purposes aforesaid.

And I, the said {{principalRepresentativeDesignation}} of {{principalName}} hereby agree to ratify and confirm whatsoever the said Attorney shall lawfully do or cause to be done in or about the premises by virtue of these presents.

IN WITNESS WHEREOF I have hereunto signed this document on the date and place first above written in the presence of following witnesses.

EXECUTANT

WITNESSES:
(1) {{witness1Name}}
(2) {{witness2Name}}`;

export const TEMPLATE_LEASE_DEED = `THIS LEASE DEED is made and executed at {{executionPlace}} on {{executionDate}}

BETWEEN

{{lessorName}} {{lessorDescription}} R/o {{lessorAddress}} hereinafter referred to as the LESSOR, which expression shall unless excluded or repugnant to the context to be deemed to include legal heirs, successors, executors, administrators, representatives and assigns of the FIRST PART.

AND

{{lesseeName}} {{lesseeDescription}} through {{lesseeRepresentative}} hereinafter referred to as the LESSEE which expression unless excluded or repugnant to the context shall include and mean, successors, successors in interest and assigns of the SECOND PART.

WHEREAS the Lessor has represented to the Lessee that she is the owner/landlady of {{propertyDescription}} at {{propertyAddress}} admeasuring {{propertyArea}} approximate covered area in the said premises and is desirous of letting out the same, hereinafter referred to as the demised premises.

AND WHEREAS the Lessee has offered to take the demised premises on Lease and the Lessor has agreed to let out the same on the terms and conditions hereinafter specified.

NOW THIS AGREEMENT WITNESSETH AS UNDER:

1. That the Lessor hereby conveys to the Lessee the said premises admeasuring {{propertyArea}} for a period of {{leasePeriodMonths}} months with effect from {{leaseStartDate}} at a monthly rent of Rs. {{monthlyRent}} exclusive of Electricity, water charges, actual bills/rental charges of Telephone/Fax whenever installed in the demised premises.

2. That the Lease will be for an initial period of {{leasePeriodMonths}} months with effect from {{leaseStartDate}}. The rent will be increased by {{rentIncreasePercent}}% of the rent payable per annum immediately after expiry of every 12 months.

3. That both, the Lessor and the Lessee have the right to terminate the Lease even before the expiry of the Lease period, by giving {{noticePeriodMonths}} months written notice.

4. That the Lessor shall have the option to renew the Lease for a further period of {{renewalPeriod}} years at the terms and conditions as laid out by the Lessor.

5. That on the date of execution of this Lease Deed, the Lessee has paid a sum of Rs. {{securityDeposit}} as security deposit which will be kept by the Lessor for the due performance of the terms and conditions of this Lease, free of interest. On termination of the Lease, the Lessor shall refund the security deposit.

6. The Lessee covenants with Lessor as under:
   i) That the Lessee agrees to pay a monthly rent of Rs. {{monthlyRent}} mentioned above on or before {{rentDueDay}} day of every month.
   ii) That the Lessee shall give vacant possession of the premises to the Lessor after the expiry of the Lease period.
   iii) That the Lessee shall duly comply with all the rules and regulations of local authorities with regard to the use of the premises.
   iv) That the Lessee shall pay the electricity charges in accordance with the bills at rates determined by the electricity board.
   v) That the demised premises have been let out to the Lessee for {{authorisedUse}} only.
   vi) That the Lessee shall permit the Lessor or his duly authorised agents during reasonable hours in the day time to enter upon the demised premises for inspection.
   vii) That the Lessee at the expiry of this Lease shall deliver peaceful and vacant possession of the demised premises to the Lessor together with the fittings and fixtures installed in good condition.
   viii) That the Lessee shall not make any alteration of permanent nature within the premises without the written consent of the Lessor.

7. That the Lessor hereby covenants with Lessee as follows:
   i) That the Lessor has good right and full power and absolute authority to Lease the demised premises to the Lessee in manner herein contained.
   ii) That the Lessor shall keep the Lessee in quiet and peaceful enjoyment of the demised premises during the currency of the Lease.

SCHEDULE OF PROPERTY

{{propertySchedule}}

IN WITNESS WHEREOF the parties hereto have set their respective hands to this deed on the date and place mentioned above in the presence of following witnesses.

LESSOR                                                        LESSEE

WITNESSES:
(1) {{witness1Name}}
(2) {{witness2Name}}`;

// ─── TEMPLATE REGISTRY ────────────────────────────────────────────────────────

export const TEMPLATE_REGISTRY: Record<string, string> = {
  india_regular_bail_bnss_480: TEMPLATE_REGULAR_BAIL,
  india_anticipatory_bail_bnss_482: TEMPLATE_ANTICIPATORY_BAIL,
  india_maintenance_application_bnss_144: TEMPLATE_MAINTENANCE_BNSS_144,
  india_suit_recovery_cpc_37: TEMPLATE_SUIT_RECOVERY_CPC37,
  india_suit_permanent_injunction: TEMPLATE_SUIT_PERMANENT_INJUNCTION,
  india_application_temp_injunction: TEMPLATE_TEMP_INJUNCTION_APPLICATION,
  india_suit_specific_performance: TEMPLATE_SUIT_SPECIFIC_PERFORMANCE,
  india_written_statement: TEMPLATE_WRITTEN_STATEMENT,
  india_restitution_conjugal_rights: TEMPLATE_RESTITUTION_CONJUGAL_RIGHTS,
  india_divorce_petition_s13: TEMPLATE_DIVORCE_S13,
  india_divorce_mutual_consent: TEMPLATE_DIVORCE_MUTUAL_CONSENT,
  india_consumer_complaint: TEMPLATE_CONSUMER_COMPLAINT,
  india_writ_petition_hc: TEMPLATE_WRIT_PETITION_HC,
  india_cheque_bounce_complaint_ni138: TEMPLATE_CHEQUE_BOUNCE_COMPLAINT,
  india_contempt_petition: TEMPLATE_CONTEMPT_PETITION,
  india_domestic_violence_petition: TEMPLATE_DOMESTIC_VIOLENCE_PETITION,
  india_will: TEMPLATE_WILL,
  india_agreement_to_sell: TEMPLATE_AGREEMENT_TO_SELL,
  india_sale_deed: TEMPLATE_SALE_DEED,
  india_general_poa: TEMPLATE_GENERAL_POA,
  india_lease_deed: TEMPLATE_LEASE_DEED,
}

/** Extract all {{placeholderNames}} from a template string */
export function extractPlaceholders(template: string): string[] {
  const matches = template.matchAll(/\{\{(\w+)\}\}/g)
  const seen = new Set<string>()
  for (const m of matches) seen.add(m[1])
  return [...seen]
}

/** Replace all {{placeholders}} in a template with provided values. Unfilled ones stay as {{placeholder}} */
export function mergeTemplate(
  template: string,
  values: Record<string, string>,
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
    const val = values[key]
    return val !== undefined && val !== "" ? val : match
  })
}

/** Check how many placeholders remain unfilled */
export function countUnfilledPlaceholders(html: string): number {
  return (html.match(/\{\{(\w+)\}\}/g) ?? []).length
}
