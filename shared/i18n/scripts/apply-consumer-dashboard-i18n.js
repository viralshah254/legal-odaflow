#!/usr/bin/env node
/**
 * Fills consumer dashboard/sidebar i18n keys across locales using existing
 * translated strings from marketing, dashboard, sectionFinder, and consumer.
 */
const fs = require('fs')
const path = require('path')

const SHARED_I18N = path.join(__dirname, '..')
const LOCALES = fs
  .readdirSync(SHARED_I18N, { withFileTypes: true })
  .filter(
    (d) =>
      d.isDirectory() &&
      !['scripts', 'extraction', 'translations'].includes(d.name),
  )
  .map((d) => d.name)

/** Short Docu Draft copy per locale (product name stays "Docu Draft"). */
const DOCUDRAFT_BY_LOCALE = {
  hi: {
    homeDocuDraftDesc: "आधिकारिक फॉर्म खोजें और AI से कानूनी दस्तावेज़ तैयार करें",
    docuDraftSubtitle:
      "अपनी जरूरत बताएं, सही फॉर्म चुनें, और AI से ड्राफ्ट बनाएं।",
  },
  bn: {
    homeDocuDraftDesc:
      "অফিসিয়াল ফর্ম খুঁজুন এবং AI দিয়ে আইনি নথি তৈরি করুন",
    docuDraftSubtitle:
      "আপনার প্রয়োজন বর্ণনা করুন, সঠিক ফর্ম মিলান এবং AI দিয়ে খসড়া তৈরি করুন।",
  },
  fr: {
    homeDocuDraftDesc:
      "Trouvez des formulaires officiels et rédigez des documents juridiques avec l'IA",
    docuDraftSubtitle:
      "Décrivez votre besoin, trouvez le formulaire adapté et générez des brouillons avec l'IA.",
  },
  de: {
    homeDocuDraftDesc:
      "Finden Sie offizielle Formulare und erstellen Sie Rechtsdokumente mit KI",
    docuDraftSubtitle:
      "Beschreiben Sie Ihr Anliegen, finden Sie passende Formulare und erstellen Sie Entwürfe mit KI.",
  },
}

function readJson(filePath) {
  if (!fs.existsSync(filePath)) return null
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`)
}

function stripGreetingComma(value) {
  return String(value ?? '')
    .replace(/,\s*$/, '')
    .trim()
}

function patchConsumer(locale) {
  const consumerPath = path.join(SHARED_I18N, locale, 'consumer.json')
  const overridePath = path.join(
    SHARED_I18N,
    'scripts/locale-overrides',
    locale,
    'consumer.json',
  )
  const marketing = readJson(path.join(SHARED_I18N, locale, 'marketing.json'))
  const dashboard = readJson(path.join(SHARED_I18N, locale, 'dashboard.json'))
  const sectionFinder = readJson(
    path.join(SHARED_I18N, locale, 'sectionFinder.json'),
  )
  const enConsumer = readJson(path.join(SHARED_I18N, 'en', 'consumer.json'))
  const consumer = readJson(consumerPath) ?? {}

  const headerConsumer = marketing?.header?.consumer ?? {}
  const footer = marketing?.footer ?? {}

  consumer.nav = {
    ...(enConsumer?.nav ?? {}),
    ...(consumer.nav ?? {}),
    home: consumer.nav?.home ?? enConsumer?.nav?.home,
    cases: headerConsumer.cases ?? consumer.nav?.cases ?? enConsumer?.nav?.cases,
    documents: consumer.nav?.documents ?? enConsumer?.nav?.documents,
    reports:
      headerConsumer.reports ?? consumer.nav?.reports ?? enConsumer?.nav?.reports,
    account:
      headerConsumer.account ?? consumer.nav?.account ?? enConsumer?.nav?.account,
    settings: consumer.nav?.settings ?? enConsumer?.nav?.settings,
    portal: consumer.nav?.portal ?? enConsumer?.nav?.portal,
    issueChecker:
      headerConsumer.issueChecker ?? enConsumer?.nav?.issueChecker,
    research: headerConsumer.research ?? enConsumer?.nav?.research,
    documentReview:
      headerConsumer.documentReview ?? enConsumer?.nav?.documentReview,
    docuDraft: enConsumer?.nav?.docuDraft,
    sectionFinder:
      headerConsumer.sectionFinder ?? enConsumer?.nav?.sectionFinder,
    findLawyer: footer.findLawyer ?? enConsumer?.nav?.findLawyer,
    lawyerReview:
      headerConsumer.lawyerReview ?? enConsumer?.nav?.lawyerReview,
    subscription:
      headerConsumer.subscription ?? enConsumer?.nav?.subscription,
    aiTools: headerConsumer.aiTools ?? enConsumer?.nav?.aiTools,
  }

  consumer.goodMorning =
    stripGreetingComma(dashboard?.greetingMorningShort) ||
    enConsumer.goodMorning
  consumer.goodAfternoon =
    stripGreetingComma(dashboard?.greetingAfternoonShort) ||
    enConsumer.goodAfternoon
  consumer.goodEvening =
    stripGreetingComma(dashboard?.greetingEveningShort) ||
    enConsumer.goodEvening

  consumer.homeSubtitle =
    marketing?.heroSubtitle ?? enConsumer.homeSubtitle
  if (locale !== 'en') {
    const firstSentence = marketing?.issueCheckerMetaDescription
      ?.split('.')[0]
      ?.trim()
    if (firstSentence) {
      consumer.homeIssueCheckerDesc =
        firstSentence.endsWith('।') || firstSentence.endsWith('.')
          ? firstSentence
          : `${firstSentence}.`
    } else {
      consumer.homeIssueCheckerDesc =
        consumer.issueChecker?.start ?? enConsumer.homeIssueCheckerDesc
    }
  } else {
    consumer.homeIssueCheckerDesc = enConsumer.homeIssueCheckerDesc
  }

  const docuDraftCopy = DOCUDRAFT_BY_LOCALE[locale]
  if (docuDraftCopy) {
    consumer.homeDocuDraftDesc = docuDraftCopy.homeDocuDraftDesc
    consumer.docuDraftSubtitle = docuDraftCopy.docuDraftSubtitle
  } else if (locale === 'en') {
    consumer.homeDocuDraftDesc = enConsumer.homeDocuDraftDesc
    consumer.docuDraftSubtitle = enConsumer.docuDraftSubtitle
  }
  consumer.homeResearchDesc =
    consumer.legal_research_subtitle ?? enConsumer.homeResearchDesc
  consumer.homeDocumentReviewDesc =
    consumer.document_review_subtitle ?? enConsumer.homeDocumentReviewDesc
  if (!docuDraftCopy && locale !== 'en') {
    consumer.homeDocuDraftDesc = enConsumer.homeDocuDraftDesc
    consumer.docuDraftSubtitle = enConsumer.docuDraftSubtitle
  }
  consumer.homeSectionFinderDesc =
    sectionFinder?.subtitle ?? enConsumer.homeSectionFinderDesc
  consumer.homeFindLawyerDesc = footer.findLawyer
    ? `${footer.findLawyer}.`
    : enConsumer.homeFindLawyerDesc
  consumer.homeCasesDesc =
    consumer.all_your_saved_legal_issue_checks ?? enConsumer.homeCasesDesc
  consumer.homeLawyerReviewDesc =
    consumer['upgrade_to_a_verified_lawyer-reviewed_report'] ??
    enConsumer.homeLawyerReviewDesc
  consumer.homeSubscriptionDesc =
    consumer.choosePlanOrTopUp ?? enConsumer.homeSubscriptionDesc

  writeJson(consumerPath, consumer)

  if (fs.existsSync(path.dirname(overridePath))) {
    const override = readJson(overridePath) ?? {}
    writeJson(overridePath, {
      ...override,
      nav: { ...(override.nav ?? {}), ...consumer.nav },
      goodMorning: consumer.goodMorning,
      goodAfternoon: consumer.goodAfternoon,
      goodEvening: consumer.goodEvening,
      homeSubtitle: consumer.homeSubtitle,
      homeIssueCheckerDesc: consumer.homeIssueCheckerDesc,
      homeResearchDesc: consumer.homeResearchDesc,
      homeDocumentReviewDesc: consumer.homeDocumentReviewDesc,
      homeDocuDraftDesc: consumer.homeDocuDraftDesc,
      homeSectionFinderDesc: consumer.homeSectionFinderDesc,
      homeFindLawyerDesc: consumer.homeFindLawyerDesc,
      homeCasesDesc: consumer.homeCasesDesc,
      homeLawyerReviewDesc: consumer.homeLawyerReviewDesc,
      homeSubscriptionDesc: consumer.homeSubscriptionDesc,
      docuDraftSubtitle: consumer.docuDraftSubtitle,
    })
  }

  console.log(`[consumer-dashboard-i18n] patched ${locale}`)
}

for (const locale of LOCALES) {
  patchConsumer(locale)
}
