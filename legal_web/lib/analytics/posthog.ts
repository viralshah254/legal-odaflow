import { AnalyticsEvents, trackEvent } from "./events"
import { trackSiteEvent } from "./site-analytics"

export { AnalyticsEvents, trackEvent } from "./events"

export function trackLandingPageView(properties: {
  utm_source?: string
  utm_medium?: string
  utm_campaign?: string
  utm_content?: string
  utm_term?: string
  referrer?: string
  device_type?: string
}): void {
  trackEvent(AnalyticsEvents.LANDING_PAGE_VIEWED, properties)
  trackSiteEvent({
    eventName: AnalyticsEvents.LANDING_PAGE_VIEWED,
    path: typeof window !== "undefined" ? window.location.pathname : undefined,
    properties: properties as Record<string, unknown>,
  })
}

export function trackLandingCtaClick(properties: {
  cta: string
  location?: string
}): void {
  trackEvent(AnalyticsEvents.LANDING_CTA_CLICKED, properties)
  trackSiteEvent({
    eventName: AnalyticsEvents.LANDING_CTA_CLICKED,
    path: typeof window !== "undefined" ? window.location.pathname : undefined,
    properties: properties as Record<string, unknown>,
  })
}

export function trackIssueCheckerSubmit(properties: {
  mode: string
  countryCode: string
  issueType: string
  authenticated?: boolean
  isFullPreview?: boolean
}): void {
  trackEvent(AnalyticsEvents.ISSUE_CHECKER_STARTED, properties)
  trackSiteEvent({
    eventName: AnalyticsEvents.ISSUE_CHECKER_STARTED,
    path: typeof window !== "undefined" ? window.location.pathname : undefined,
    properties: properties as Record<string, unknown>,
  })
}

export function trackReportGenerated(properties: {
  reportId: string
  countryCode: string
  issueType?: string
}): void {
  trackEvent("report_generated", properties)
}

export function trackLawyerSignup(properties: {
  countryCode: string
  firmName?: string
  authProvider?: string
}): void {
  trackEvent("lawyer_signup", properties)
}

export function trackCheckoutStarted(properties: {
  checkoutType: "subscription" | "credit_topup" | "lawyer_review"
  amount?: number
  currency?: string
  packId?: string
  tenantId?: string
}): void {
  trackEvent(AnalyticsEvents.SUBSCRIPTION_CHECKOUT_STARTED, properties)
}

export function trackCheckoutCompleted(properties: {
  checkoutType: "subscription" | "credit_topup" | "lawyer_review"
  amount?: number
  currency?: string
  paymentId?: string
}): void {
  trackEvent(AnalyticsEvents.CHECKOUT_COMPLETED, properties)
}

export function trackCheckoutAbandoned(properties: {
  checkoutType: "subscription" | "credit_topup" | "lawyer_review"
  reason?: string
}): void {
  trackEvent(AnalyticsEvents.CHECKOUT_ABANDONED, properties)
}
