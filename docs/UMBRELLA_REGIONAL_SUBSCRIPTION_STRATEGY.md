# Umbrella regional subscription and mobile pricing strategy

Planning date: 9 November 2026, Africa/Nairobi. Status: target commercial catalog for implementation under the user's authorization. Existing subscribers retain their contracted terms until a deliberate migration; store configuration and publication follow validated entitlement and purchase flows.

Offer subscriptions for individual legal professionals and firms, with affordable India pricing, a Kenya middle tier and a professional entry package of at least US$100 per month in higher-priced markets. Charge measured AI usage at twice the recorded provider cost using one credit denomination. Preserve the same task charge on web and mobile; account for store fees in the product purchase price. This strategy accompanies [the firm workflow master plan](UMBRELLA_FIRM_WORKFLOW_MASTER_PLAN.md).

## Audience and regional rules

“Individual” here means a solo lawyer or independent legal professional. Public consumers seeking occasional legal information remain a separately priced audience; do not silently replace their current subscriptions with a $100 professional package. The proposed default is that all paid professional markets outside India and Kenya use the global tier until a deliberate country catalog is approved. Uganda therefore starts in the global commercial tier unless a specific regional exception is approved; legal feature availability remains an independent capability decision.

Use billing residence/business establishment and payment/storefront evidence to determine price eligibility. Firm region is a contract/account attribute, not the current location of an employee. Device language, VPN or travel must not change a subscription. Cross-border offices, country changes and conflicting evidence go through a clear account process; record the applicable catalog version. Legal jurisdiction and data residency never determine price implicitly.

## Proposed monthly web catalog

Prices below are commercial hypotheses for approval and pilot validation, before applicable taxes. INR and KES are deliberately set local list prices, not conversions using the app's old fixed FX values. Global prices use USD as the planning reference; GBP and other local prices require a versioned published catalog and an FX review so the professional entry price meets the $100-equivalent policy when set.

| Package | Included professional seats | India | Kenya | Global including US and UK reference |
|---|---:|---:|---:|---:|
| Solo | 1 | INR 1,499/month | KES 6,500/month | USD 100/month |
| Solo Pro | 1 | INR 2,999/month | KES 12,000/month | USD 200/month |
| Firm Team | 5 | INR 7,499/month | KES 30,000/month | USD 500/month |
| Firm Growth | 10 | INR 14,999/month | KES 55,000/month | USD 900/month |
| Enterprise | Contracted | At least Growth-equivalent, scoped quote | At least Growth-equivalent, scoped quote | From USD 2,000/month, scoped quote |

Proposed additional professional seats: INR 1,499, KES 5,500 or USD 90 per month on firm plans, with the corresponding incremental shared usage allowance. Include two coordinator seats on Team and four on Growth for permitted administrative work; these seats have no independent AI-generation allowance and receive no matter-content access automatically. Guest clients can access explicitly shared resources without a professional seat; their AI activity consumes a controlled sponsoring-firm budget. Define concurrency, storage and bulk-processing limits in the final catalog.

Solo includes matter/client management, documents/folders, supported-country research and drafting, calendar/tasks, reminders, personal style, export and web/mobile access. Pro increases included usage and capacity and adds configurable personal automations. Firm plans add pooled credits, supervised work, team assignment, review queues, budgets and shared approved knowledge. Growth expands capacity, reporting and automation administration. Enterprise covers negotiated integration, identity, residency, support and operational needs.

Security is not an upgrade incentive: tenant isolation, resource permissions, matter restrictions, secure sharing, MFA capability, auditability and confidentiality defaults apply across the paid product. Do not restrict source verification or correct jurisdiction behavior to expensive tiers.

## Annual billing trials and discounts

Proposed annual prices for India and Kenya equal ten monthly payments, billed upfront, with monthly AI allowances. Global Solo remains USD 1,200/year to preserve the $100 effective-monthly floor. Global Pro, Team and Growth annual prices equal 10.2 monthly payments: USD 2,040, USD 5,100 and USD 9,180 respectively. These are candidate commercial discounts, not store promotional products already configured.

Offer a 14-day evaluation with a small disclosed AI budget and no automatic external actions. A cardless trial has no automatic paid conversion; a store or card-backed trial must clearly disclose conversion and cancellation. No permanent free professional AI tier is proposed. Provide a reasonable read/export path after cancellation, subject to contract and retention policy, so losing a subscription does not strand a client's file.

Do not discount below the global Solo minimum through coupons, annual offers or an unapproved regional override. Student, public-interest or negotiated exceptions require an explicitly separate policy. Existing subscribers need a migration/grandfathering decision, notice and any required consent before price changes; no automatic conversion during the fixes release.

## Included AI usage and credit definition

Use the active fixes' proposed denomination of USD 0.01 per credit, confirmed at handoff. A credit measures retail AI usage budget; it is not a promise of one fixed-length answer or a cash balance redeemable by the customer.

`task credits = ceil(2 × total eligible actual provider cost in USD / 0.01)`

Aggregate all eligible calls for the task before rounding, including retries that actually incurred cost, verification and chargeable auxiliary operations under the published policy. Rates need provider/model version, cache/thinking-token treatment and any non-token charges. Do not charge a fixed 500-credit style fee or a second markup solely because a task ran on mobile. Separate client matter invoices from Umbrella platform billing.

Proposed global monthly included allowances:

| Package | Included credits | Retail usage budget | Provider cost if fully consumed |
|---|---:|---:|---:|
| Solo | 1,000 | USD 10 | USD 5 |
| Solo Pro | 4,000 | USD 40 | USD 20 |
| Firm Team | 10,000 pooled | USD 100 | USD 50 |
| Firm Growth | 20,000 pooled | USD 200 | USD 100 |
| Additional professional seat | 2,000 pooled | USD 20 | USD 10 |

For India and Kenya, set the included retail usage budget initially to 20% of the plan's tax-exclusive local web list price, translated into USD using the approved catalog FX reference. Round the allowance down to whole credits when publishing a catalog version. Each extra regional professional seat contributes the same 20% retail-budget rule. Publish exact credit counts before launch and freeze a subscribed catalog's allowance for its committed term; no daily FX-driven credit changes.

An actual provider cost of USD 0.08 consumes 16 credits. A USD 0.60 task consumes 120 credits. A 1,000-credit allowance therefore funds at most USD 5 of provider cost, with task counts depending on document size and workflow. Measure whether this supports useful professional work before approving the allowances; regional affordability depends on actual task cost rather than a marketing promise of “unlimited AI.”

Proposed top-ups use the same 2× usage economics: 1,000 credits cost USD 10 on web before tax and processor costs; 5,000 cost USD 50. Publish local catalog prices and approved store equivalents. Regional subscription discounts do not make provider costs cheaper; avoid selling the same credit below the required margin through FX or pack discounts.

Track subscription allowances, purchased credits, trial grants and promotional credits in separate ledger buckets. Purchased top-ups should not expire; Apple explicitly prohibits expiry for credits purchased through IAP. Monthly included-service quota resets and promotional conditions need transparent terms and store review; do not mislabel a purchased credit as an expiring promotion. Spend expiring eligible grants first, retain purchase provenance and display balances by bucket.

Reservations must hold budget atomically and settlement must be idempotent. Users see an estimate/range before unusually expensive work, a firm/user/matter limit and an over-budget choice. Default to no surprise automatic top-up. Define whether failed/interrupted tasks incur a charge; recommended customer policy is no charge for a platform-caused failure with no usable result, while recording the provider cost internally. Cancellation may retain explicitly disclosed consumed usage. Never charge twice for reconnecting or retrying the same completed operation.

## Economics and margin gates

For global Solo at USD 100 with USD 5 included provider cost, the subscription has USD 95 before payment fees, infrastructure, storage, OCR/search costs outside that allowance, support, taxes, refunds and acquisition costs. That is a contribution calculation, not a 95% business profit claim. Track subscription revenue and AI usage margin separately; the 2× usage rule implies 50% gross margin on AI retail value before other costs.

Pilot assumptions must include actual generation/verification, public search, embeddings, OCR, translation, storage, egress, notification channels, integration operations and support. Define which costs are included in AI task settlement and which are subscription operating costs so they are never charged twice. Set operational limits and paid add-ons for exceptional bulk processing rather than hiding an unlimited promise behind later throttling.

Proposed approval gate: at least 70% direct contribution margin at normal cohort usage, and positive contribution at the agreed heavy-use percentile after paid top-ups and capacity controls. Validate with workload samples from India, Kenya and global firms, including long multi-document litigation. Adjust allowance or package price before launch if the entry package cannot fund a useful workflow. Google promotional credits are a temporary financing benefit; compute economics using underlying provider rates as well as actual promotional cash spend.

## Mobile purchase price and fee recovery

For a tax-exclusive web target P and an applicable store deduction f, a simple proceeds-preserving store price is `P / (1 − f)`. If comparing net proceeds after web payment fees as well, use `P × (1 − web fee) / (1 − store fee)`, with fixed fees and tax treatment handled separately. Configure components from actual agreements and settlement reports; do not blindly add percentages that apply to different bases.

| Applicable combined deduction | Gross-up factor | Store reference price to retain USD 100 before tax |
|---|---:|---:|
| 15% | 1.1764706 | USD 117.65 |
| 20% | 1.25 | USD 125.00 |
| 30% | 1.4285714 | USD 142.86 |

Choose the nearest permitted local store price point that meets the intended proceeds target and show the store-returned localized price. The same package includes the same credits/entitlements across purchase channels. A user already subscribed on web or through a firm logs in to the applicable entitlement rather than purchasing it again. Detect active subscriptions and prevent accidental double payment across stores and web.

Apple's published standard subscription structure describes 70% proceeds before applicable tax during the first paid year and 85% after one paid year; the Small Business Program offers a 15% commission for eligible enrolled developers. Eligibility depends on associated accounts and thresholds, so do not assume enrollment. Special storefront terms can differ. Sources: [Apple subscriptions](https://developer.apple.com/app-store/subscriptions/) and [Small Business Program](https://developer.apple.com/app-store/small-business-program/).

Google's current fee page distinguishes regional rollout and product categories. Its listed auto-renewing subscription rate in the US/UK/EEA/Australia/Japan is 10% service fee plus 5% when Play Billing applies; the page lists 15% subscriptions in remaining markets pending rollout. Other products such as consumable credit packs can have different rates based on region, install cohort and program. Do not apply the subscription fee universally to top-ups. Source: [Google Play service fees](https://support.google.com/googleplay/android-developer/answer/112622?hl=en).

The launch catalog needs a fee table keyed by store, storefront, product category, effective date, enrollment and applicable subscription tenure/cohort. Revalidate the rules and actual account agreements before setting prices; a single hardcoded global mobile multiplier is insufficient.

## Store payment model and entitlement design

Individual digital subscriptions and credit purchases should use StoreKit and Google Play Billing unless a verified storefront/program exception applies. Do not treat the existing hosted checkout WebView as a universal digital-goods solution. External links and alternative billing require their own regional rules. Apple describes a limited enterprise-services exception for direct organizational employee/student sales, but its conditions do not automatically apply to a mixed solo/consumer/firm app. Sources: [Apple payment guidelines](https://developer.apple.com/app-store/review/guidelines/#payments) and [Google payments policy](https://support.google.com/googleplay/android-developer/answer/9858738?hl=en).

Separate firm contracts, individual digital subscriptions, consumable AI top-ups and real legal-service payments in the catalog. A payment to a lawyer is not the same product as access to Umbrella AI; review its payment treatment independently. Firm employees should consume their firm's allocation rather than being pushed into a personal mobile subscription.

The backend owns one entitlement model with account/tenant, payer, product, seats, allowance, billing interval, purchase channel, store identity, effective dates, renewal/grace state and catalog version. Validate signed transactions/tokens server-side, ingest store lifecycle events idempotently and reconcile periodically. Do not grant durable access merely because a client navigated to a URL containing “success.”

Support renewals, grace periods, billing retry/account hold, cancellation, refunds/revocations, upgrade/downgrade timing, seat changes, restore/reinstall, transfers allowed by the platform and linked existing accounts. Restore restorable products through store mechanisms; recover consumed top-up balances through the server ledger rather than promising that a consumable purchase is store-restorable. Account switching cannot spend another person's or firm's receipt.

## Store setup plan after pricing approval

The user reports App Store Connect and Play Console are open in Brave. Leave them unchanged during this planning task. Review them read-only at the later setup stage to confirm app identity, agreements, tax/banking status, program enrollment and existing product IDs before creating anything.

1. Approve package names, region mapping, taxes, allowances, storage/processing limits, annual terms, fee recovery and existing-subscriber migration.
2. Confirm bundle/package IDs and existing products. Map current plan IDs to the new catalog; do not delete or reuse incompatible store IDs.
3. Define one coherent individual subscription group/hierarchy on Apple and the appropriate Google subscription/base-plan structure; manage organizational contracts separately. Configure consumable top-ups as distinct products.
4. Prepare localized prices and descriptions, subscription disclosures, privacy/data-safety statements, support/terms URLs, account deletion and App Review test access.
5. Implement native purchases, server verification, notifications/reconciliation, entitlement linking, duplicate-purchase detection and restore/manage-subscription flows.
6. Validate sandbox/license-test journeys across IN, KE, US and GB, including failed/renewed/refunded purchases, account switch, store outages and a pre-existing firm entitlement.
7. Submit with accurate review notes and staged rollout. Publishing and production price changes require a concrete later review; no setup is performed by this plan.

## Commercial decisions to settle before setup

Approve or revise the proposed price table; decide whether Uganda merits a middle-tier exception; validate included AI budgets against useful real workloads; choose storage/bulk-processing limits and support levels; confirm the public-consumer strategy; decide grandfathering, annual/refund policy and the actual store enrollment/fee profile. These are bounded decisions around a concrete proposed catalog, not a reason to change the active fixes or begin implementation now.
