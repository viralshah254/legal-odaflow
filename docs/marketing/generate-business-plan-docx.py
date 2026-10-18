#!/usr/bin/env python3
"""
Generate Umbrella 30+ page Business Plan (Word).
India + US focus (Year 1). Global vision over 3 years.
"""

from datetime import date
from pathlib import Path

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Inches, Pt, RGBColor

from business_plan_diagrams import generate_all as generate_diagrams

DIR = Path(__file__).parent
OUTPUT = DIR / "UMBRELLA-1-YEAR-BUSINESS-PLAN.docx"

NAVY = RGBColor(15, 23, 42)
TEAL = RGBColor(13, 148, 136)
SLATE = RGBColor(71, 85, 105)


# ── Helpers ───────────────────────────────────────────────────────────────

def set_cell_shading(cell, hex_color: str):
    shading = OxmlElement("w:shd")
    shading.set(qn("w:fill"), hex_color)
    shading.set(qn("w:val"), "clear")
    cell._tc.get_or_add_tcPr().append(shading)


def heading(doc, text, level=1):
    h = doc.add_heading(text, level=level)
    for run in h.runs:
        run.font.color.rgb = NAVY
    return h


def body(doc, text, bold=False, italic=False):
    p = doc.add_paragraph()
    run = p.add_run(text)
    run.font.size = Pt(11)
    run.font.color.rgb = SLATE
    run.bold = bold
    run.italic = italic
    p.paragraph_format.space_after = Pt(6)
    return p


def bullet(doc, text, level=0):
    p = doc.add_paragraph(text, style="List Bullet")
    p.paragraph_format.left_indent = Inches(0.25 * (level + 1))
    for run in p.runs:
        run.font.size = Pt(10)
        run.font.color.rgb = SLATE
    return p


def add_styled_table(doc, headers, rows, col_widths=None):
    table = doc.add_table(rows=1 + len(rows), cols=len(headers))
    table.style = "Table Grid"
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    hdr = table.rows[0].cells
    for i, h in enumerate(headers):
        hdr[i].text = h
        for p in hdr[i].paragraphs:
            for run in p.runs:
                run.bold = True
                run.font.size = Pt(9)
                run.font.color.rgb = RGBColor(255, 255, 255)
        set_cell_shading(hdr[i], "0F172A")
    for ri, row in enumerate(rows):
        cells = table.rows[ri + 1].cells
        for ci, val in enumerate(row):
            cells[ci].text = str(val)
            for p in cells[ci].paragraphs:
                for run in p.runs:
                    run.font.size = Pt(9)
        if ri % 2 == 1:
            for c in cells:
                set_cell_shading(c, "F8FAFC")
    if col_widths:
        for row in table.rows:
            for i, w in enumerate(col_widths):
                row.cells[i].width = Inches(w)
    doc.add_paragraph()
    return table


def add_diagram(doc, path, width=6.0, caption=None):
    doc.add_picture(str(path), width=Inches(width))
    last = doc.paragraphs[-1]
    last.alignment = WD_ALIGN_PARAGRAPH.CENTER
    if caption:
        p = doc.add_paragraph()
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        r = p.add_run(caption)
        r.font.size = Pt(9)
        r.font.color.rgb = SLATE
        r.italic = True
    doc.add_paragraph()


def page_break(doc):
    doc.add_page_break()


def toc_entry(doc, text, page=""):
    p = doc.add_paragraph()
    r = p.add_run(text)
    r.font.size = Pt(11)
    r.font.color.rgb = SLATE
    if page:
        p.add_run("\t" + page)


# ── Document ──────────────────────────────────────────────────────────────

def build_document():
    diagram_paths = generate_diagrams()
    doc = Document()
    for section in doc.sections:
        section.top_margin = Inches(1)
        section.bottom_margin = Inches(1)
        section.left_margin = Inches(1)
        section.right_margin = Inches(1)

    # ══════════════════════════════════════════════════════════════════════
    # COVER
    # ══════════════════════════════════════════════════════════════════════
    for _ in range(6):
        doc.add_paragraph()
    t = doc.add_paragraph()
    t.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = t.add_run("UMBRELLA BY OKAY LEGAL")
    r.bold = True
    r.font.size = Pt(32)
    r.font.color.rgb = NAVY

    s = doc.add_paragraph()
    s.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r2 = s.add_run("Comprehensive Business Plan")
    r2.font.size = Pt(20)
    r2.font.color.rgb = TEAL

    s2 = doc.add_paragraph()
    s2.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r3 = s2.add_run(
        "India → United States → The World\n"
        "3-Year Global Strategy · Year 1 Execution Plan\n\n"
        f"Version 2.0 · {date.today().strftime('%B %d, %Y')}\n"
        "CONFIDENTIAL — Internal & Investor Use Only\n\n"
        "umbrella.okaylegal.ai"
    )
    r3.font.size = Pt(12)
    r3.font.color.rgb = SLATE

    page_break(doc)

    # ══════════════════════════════════════════════════════════════════════
    # TABLE OF CONTENTS
    # ══════════════════════════════════════════════════════════════════════
    heading(doc, "Table of Contents")
    toc = [
        "1. Executive Summary",
        "2. The Opportunity — Why Now, Why Us, Why Global",
        "3. Three-Year Global Strategy (India → US → World)",
        "4. Market Analysis — India",
        "5. Market Analysis — United States",
        "6. Product Strategy & Technology Roadmap",
        "7. Go-to-Market — India (Year 1 Primary)",
        "8. Go-to-Market — United States (Year 1 Secondary)",
        "9. Year 1 Monthly & Weekly Execution Plan",
        "10. Marketing Strategy, Channels & Budget",
        "11. Financial Model & Unit Economics",
        "12. Fundraising Strategy & Use of Funds",
        "13. Organization, Governance & Operating Model",
        "14. Risk Management & Contingency Plans",
        "15. KPI Dashboard & Reporting Cadence",
        "16. Role Assignments — Co-CEO / CTO (Engineering)",
        "17. Role Assignments — Garima (Co-CEO / CFO / CMO)",
        "18. Years 2–3 Preview — Global Expansion",
        "Appendix A: Competitive Landscape",
        "Appendix B: Product Feature Inventory Summary",
        "Appendix C: Key URLs & Assets",
        "Appendix D: Glossary",
        "Appendix E: Monthly Revenue Build-Up",
        "Appendix F: Weekly Channel Scorecard Template",
        "Appendix G: Investor FAQ",
        "Appendix H: Detailed Weekly Plan — Q3 2026",
        "Appendix I: Technology Stack Detail",
        "Appendix J: Brand Voice & Messaging Guidelines",
    ]
    for item in toc:
        toc_entry(doc, item)
    page_break(doc)

    # ══════════════════════════════════════════════════════════════════════
    # 1. EXECUTIVE SUMMARY
    # ══════════════════════════════════════════════════════════════════════
    heading(doc, "1. Executive Summary")

    body(doc,
         "Umbrella by Okay Legal is the AI-powered Legal Operating System for practicing lawyers. "
         "We launched on Sunday, July 5, 2026. After resolving initial launch bugs, the platform is "
         "now live at umbrella.okaylegal.ai with production-grade India drafting, legal research, "
         "FIR analysis, document review, lawyer leads inbox, matter management, billing, and mobile apps.")

    body(doc,
         "Our strategy is deliberately sequenced: dominate India first (product-market fit + volume), "
         "build US credibility and ARPU in parallel during Year 1, then expand to the rest of the "
         "world over Years 2–3. We do not pursue Africa or other developing markets in Year 1 — "
         "every dollar and engineering hour goes to India and the US, the two largest legal economies "
         "where our product has the strongest fit.")

    heading(doc, "Mission", level=2)
    body(doc, "Give every lawyer in the world an AI-powered practice — starting with India and America.")

    heading(doc, "Year 1 Targets (Jul 2026 – Jun 2027)", level=2)
    add_styled_table(doc,
        ["Metric", "Target", "Notes"],
        [
            ["Lawyer sign-ups", "1,500", "India 70% · US 30%"],
            ["Activated lawyers", "900", "Completed onboarding + 1 core action"],
            ["Paying firms/lawyers", "200", "Post 30-day free trial"],
            ["MRR (exit run-rate)", "$50,000", "India $27K + US $21K + other $2K"],
            ["ARR run-rate", "$600,000", "Seed-ready metric"],
            ["D7 retention (activated)", "> 50%", "Gate before paid scale"],
            ["Trial-to-paid conversion", "> 20%", "By Month 9"],
            ["Lawyer leads delivered", "2,000 total", "Issue Checker flywheel"],
        ], [2.0, 1.2, 2.3])

    heading(doc, "The 100× Ambition", level=2)
    body(doc,
         "From a post-launch baseline of ~10 lawyers and near-zero MRR, we target 100× growth on "
         "activated users (10 → 1,000+) and MRR ($500 month-1 → $50,000 month-12). We get there "
         "through focused India + US execution: city-first market entry, a clear product wedge, "
         "founder-led onboarding, and the Issue Checker → lawyer leads growth loop.")

    heading(doc, "Leadership", level=2)
    add_styled_table(doc,
        ["Role", "Person", "Accountability"],
        [
            ["Co-CEO / CTO", "Engineering Co-Founder", "Product, technology, AI, infrastructure, India product depth"],
            ["Co-CEO / CFO / CMO", "Garima", "Finance, fundraising, marketing, sales, US GTM, operations"],
        ], [1.8, 1.5, 2.2])

    heading(doc, "Immediate Priority: 100 Lawyers by July 20", level=2)
    body(doc,
         "Before the monthly plan begins in earnest, we have a 12-day sprint (July 8–20) to sign "
         "100 lawyers, activate 60+, and convert 5+ to paid. India carries 85% of this sprint via "
         "influencer reels, WhatsApp advocate networks, webinars, and founder-led onboarding.")

    page_break(doc)

    # ══════════════════════════════════════════════════════════════════════
    # 2. THE OPPORTUNITY
    # ══════════════════════════════════════════════════════════════════════
    heading(doc, "2. The Opportunity — Why Now, Why Us, Why Global")

    heading(doc, "2.1 Market Size", level=2)
    body(doc,
         "Legal services represent an $800B+ global market. Legal technology is growing at 8–12% CAGR, "
         "with AI-native legal tools representing the fastest-growing subsegment. India alone has "
         "1.7M+ enrolled advocates with ~600K actively practicing. The US has 1.3M licensed attorneys "
         "generating $300B+ in annual legal revenue.")

    add_styled_table(doc,
        ["Segment", "TAM", "SAM (AI practice tools)", "SOM Year 3"],
        [
            ["India lawyers", "₹12,000Cr+ practice software", "₹1,200Cr", "₹60Cr (5%)"],
            ["US lawyers", "$12B legal tech", "$2.4B AI-native", "$120M (5%)"],
            ["Global (Year 3+)", "$28B legal tech 2028", "$5B AI-native", "$250M (5%)"],
        ], [1.5, 1.8, 1.8, 1.4])

    heading(doc, "2.2 Why Now", level=2)
    bullet(doc, "GPT-4 class models make legal drafting and research commercially viable for the first time.")
    bullet(doc, "India's legal system is digitizing — eCourts, eFiling, and advocate tech adoption accelerating post-COVID.")
    bullet(doc, "US solo and small firms (75% of all firms) are underserved by Clio/MyCase — none offer AI-native workflows.")
    bullet(doc, "Consumer legal anxiety is at an all-time high — Issue Checker creates a lawyer lead pipeline no competitor has.")
    bullet(doc, "Window: 18–24 months before Big Law tech (Harvey, CoCounsel) moves downmarket.")

    heading(doc, "2.3 Why Umbrella Wins", level=2)
    add_styled_table(doc,
        ["Capability", "Umbrella", "Clio/MyCase", "Harvey/CoCounsel", "Generic AI (ChatGPT)"],
        [
            ["India drafting (IPC/CrPC)", "✅ Production", "❌", "❌", "⚠ Unverified"],
            ["US drafting", "🟡 Partial → GA Oct", "❌", "✅", "⚠"],
            ["Lawyer lead generation", "✅ Issue Checker", "❌", "❌", "❌"],
            ["Full firm OS (matters, billing)", "✅", "✅", "❌", "❌"],
            ["Mobile app", "✅", "✅", "❌", "✅"],
            ["Price (solo lawyer)", "₹1,400 / $50 seat", "$39–99", "$500+", "$20"],
            ["Multi-jurisdiction", "✅ Roadmap", "US only", "US/EU", "Global but unsafe"],
        ], [1.5, 1.2, 1.0, 1.2, 1.3])

    heading(doc, "2.4 Strategic Sequencing", level=2)
    body(doc,
         "We are not trying to boil the ocean in Year 1. The global opportunity is real — but "
         "distribution follows product depth. India gives us volume, iteration speed, and a "
         "defensible AI drafting moat. The US gives us ARPU, investor credibility, and enterprise "
         "expansion. Everything else waits until we have $150K+ MRR and proven unit economics.")

    add_diagram(doc, diagram_paths[0], 6.5, "Figure 1: Three-year expansion — India + US in Year 1, then global scale")

    page_break(doc)

    # ══════════════════════════════════════════════════════════════════════
    # 3. THREE-YEAR STRATEGY
    # ══════════════════════════════════════════════════════════════════════
    heading(doc, "3. Three-Year Global Strategy")
    body(doc,
         "We plan against two financial scenarios. The Base Plan is our original investor-ready "
         "path: prove PMF in India + US, reach $50K MRR, raise Seed, scale to ~$6M ARR by Year 3. "
         "The Scale Plan is our ambitious path to $50M ARR by Year 3 — requiring US enterprise "
         "motion, Issue Checker consumer scale, and $25M+ Series A. Both share the same product "
         "and flywheel; they differ in capital, team size, and GTM intensity.")

    heading(doc, "3.0 Dual Scenario Summary", level=2)
    add_styled_table(doc,
        ["Metric", "Base Plan (Original)", "Scale Plan ($50M ARR)", "Multiple"],
        [
            ["Y1 exit MRR (Jun 2027)", "$50K", "$175K", "3.5×"],
            ["Y2 exit MRR (Jun 2028)", "$200K", "$1.25M", "6.3×"],
            ["Y3 exit MRR (Jun 2029)", "$500K", "$4.17M", "8.3×"],
            ["Y3 ARR run-rate", "$6M", "$50M", "8.3×"],
            ["Y3 paying firms", "2,000+", "15,000+", "7.5×"],
            ["Y3 team size", "40–50", "150–200", "3.5×"],
            ["Seed round", "$1.5–2.5M", "$3–5M", "2×"],
            ["Series A", "$8–12M", "$25M", "2.5×"],
            ["Series B", "—", "$50M (Y3)", "—"],
        ], [1.5, 1.3, 1.3, 0.8])
    body(doc,
         "Financial model: docs/marketing/UMBRELLA-3-YEAR-FINANCIAL-MODEL.xlsx — toggle scenario on "
         "Assumptions tab (Base or Scale). All cells use Excel formulas linked to assumptions.",
         italic=True)

    heading(doc, "3.1 Year 1 — India + US (Jul 2026 – Jun 2027)", level=2)
    body(doc, "Objective: Prove product-market fit in two markets. Base: $50K MRR. Scale: $175K MRR. Raise Seed round.")
    add_styled_table(doc,
        ["Market", "Effort", "Sign-ups", "Paying", "MRR Target"],
        [
            ["India", "70%", "1,050", "140", "$27K"],
            ["United States", "30%", "450", "60", "$21K"],
        ], [1.2, 0.8, 1.0, 0.8, 1.0])

    heading(doc, "3.2 Year 2 — US Heavy + India Scale (Jul 2027 – Jun 2028)", level=2)
    body(doc, "Objective: US becomes primary revenue driver. India transitions to self-serve scale. Enter UK, Canada, Australia.")
    add_styled_table(doc,
        ["Market", "Effort", "Paying", "MRR Target", "Key Action"],
        [
            ["United States", "50%", "400", "$200K", "Sales team, ABA partnerships, integrations"],
            ["India", "35%", "500", "$80K", "Enterprise, bar associations, self-serve"],
            ["UK / CA / AU", "15%", "80", "$40K", "English-common-law expansion"],
        ], [1.2, 0.7, 0.8, 1.0, 2.0])

    heading(doc, "3.3 Year 3 — Rest of World (Jul 2028 – Jun 2029)", level=2)
    body(doc, "Objective: Base — $500K+ MRR (~$6M ARR). Scale — $4.17M MRR ($50M ARR). Series A/B. EU, LATAM, APAC, MENA.")
    add_styled_table(doc,
        ["Region", "Entry Strategy", "MRR Target", "Prerequisite"],
        [
            ["European Union", "GDPR-ready · UK beachhead", "$80K", "SOC2 Type II complete"],
            ["Latin America", "Spanish/Portuguese drafting", "$40K", "US LATAM diaspora GTM"],
            ["APAC (SG, JP, KR)", "English-first, local partnerships", "$60K", "Enterprise sales team"],
            ["MENA", "UAE hub · English courts", "$30K", "Data residency option"],
        ], [1.2, 2.0, 1.0, 1.5])

    heading(doc, "3.4 Growth Model", level=2)
    body(doc,
         "Umbrella grows through four reinforcing mechanisms — not paid ads alone:")
    bullet(doc, "Founder-led onboarding: personal calls and WhatsApp for the first 90 days until activation exceeds 60%.")
    bullet(doc, "City-first entry: dominate Delhi NCR or Mumbai before national India spend; one US practice area before broad legal.")
    bullet(doc, "Product wedge: lead with legal notice drafting in 2 minutes; expand to full Lawyer OS during onboarding.")
    bullet(doc, "Issue Checker loop: consumers get clarity → lawyers receive pre-analyzed leads → lawyers subscribe and share the checker.")
    bullet(doc, "Retention gates: no paid acquisition scale until D7 retention exceeds 40% and trial-to-paid exceeds 15%.")

    add_diagram(doc, diagram_paths[1], 5.0, "Figure 2: Growth flywheel — each turn reduces CAC and increases LTV")

    heading(doc, "3.5 Scale Plan — Path to $50M ARR", level=2)
    body(doc,
         "The Scale Plan requires three revenue engines running in parallel by Year 3. "
         "India supplies volume and the Issue Checker flywheel. The US supplies ARPU via "
         "enterprise deals. Global expansion and Consumer Plus fill the remainder.")

    add_styled_table(doc,
        ["Engine", "Y3 MRR Target", "Key Actions"],
        [
            ["US SMB + mid-market", "$1.8M", "15 AEs + 8 SDRs; ABA/state bar partnerships; Clio displacement"],
            ["US enterprise (10+ seats)", "$1.2M", "60 deals × ~$20K/mo; SSO, SCIM, SOC2 Type II"],
            ["India volume", "$600K", "10,000 firms; national bar MOUs; influencer → referral loop"],
            ["UK / CA / AU / EU", "$400K", "Common-law + EU localization; GDPR-ready infrastructure"],
            ["Consumer Plus + credits", "$170K", "50K+ consumer subs; AI credit upsell; NRR > 120%"],
        ], [1.5, 1.0, 2.8])

    heading(doc, "3.6 Scale Plan — Year-by-Year Milestones", level=2)
    add_styled_table(doc,
        ["Year", "Exit MRR", "ARR", "Key milestone"],
        [
            ["Y1 (Jun 2027)", "$175K", "$2.1M", "Flywheel proven; Seed $3–5M; first enterprise LOI"],
            ["Y2 (Jun 2028)", "$1.25M", "$15M", "US sales team live; Series A $25M; 5 enterprise closes"],
            ["Y3 (Jun 2029)", "$4.17M", "$50M", "Series B $50M; 15+ countries; 150–200 team"],
        ], [1.0, 1.0, 1.0, 2.5])

    page_break(doc)

    # ══════════════════════════════════════════════════════════════════════
    # 4. INDIA MARKET
    # ══════════════════════════════════════════════════════════════════════
    heading(doc, "4. Market Analysis — India")

    heading(doc, "4.1 Market Structure", level=2)
    body(doc,
         "India has the world's second-largest legal profession. The market is fragmented: 70%+ are "
         "solo practitioners or firms under 5 lawyers. These advocates are price-sensitive but "
         "increasingly tech-forward — WhatsApp is the operating system of Indian legal practice.")

    add_styled_table(doc,
        ["Segment", "Size", "Willingness to Pay", "Umbrella Fit"],
        [
            ["Solo advocates", "~400K active", "₹500–2,000/mo", "★★★★★ Primary"],
            ["Small firms (2–10)", "~80K firms", "₹5,000–30,000/mo", "★★★★★ Primary"],
            ["Mid firms (10–50)", "~8K firms", "₹50K–3L/mo", "★★★★ Year 2"],
            ["Large firms (50+)", "~500", "Enterprise", "★★★ Year 3"],
            ["Corporate legal (in-house)", "~15K", "Different product", "★★ Future"],
        ], [1.5, 1.2, 1.5, 1.3])

    heading(doc, "4.2 India Pricing Strategy", level=2)
    add_styled_table(doc,
        ["Plan", "Price (per seat/mo)", "Target User", "AI Credits"],
        [
            ["Starter", "₹1,400", "Solo · 1–3 seats", "~660"],
            ["Professional", "₹6,000", "Small firm · copilot", "~2,800"],
            ["Pro Plus", "₹30,000", "High-volume practice", "~14,000"],
            ["Enterprise", "Contact sales", "10+ seats · SSO", "Custom"],
        ], [1.2, 1.3, 1.8, 1.2])
    body(doc, "Anchor: ₹1,400 = cost of one client consultation. 30-day free trial on all plans.")

    heading(doc, "4.3 India Competitive Landscape", level=2)
    bullet(doc, "Manual / Word templates — status quo, 90% of market. Our enemy is inertia, not software.")
    bullet(doc, "Vakilsearch / LegalRaasta — consumer-focused, not lawyer OS.")
    bullet(doc, "CaseMine / Manupatra — research databases, no AI drafting or firm OS.")
    bullet(doc, "ChatGPT — used by 30%+ of young advocates but unverified, no India-specific citations.")
    bullet(doc, "Umbrella moat: India drafting with IPC/CrPC verification + lawyer leads loop.")

    heading(doc, "4.4 India City-First Strategy — Phase 1", level=2)
    body(doc,
         "Before national spend, we must own ONE city. Recommendation: Delhi NCR (largest advocate "
         "concentration, Saket/Tis Hazari courts, strong WhatsApp networks) OR Mumbai (Bombay HC ecosystem). "
         "Target: 50 activated lawyers in chosen city by August 31, 2026.")

    page_break(doc)

    # ══════════════════════════════════════════════════════════════════════
    # 5. US MARKET
    # ══════════════════════════════════════════════════════════════════════
    heading(doc, "5. Market Analysis — United States")

    heading(doc, "5.1 Market Structure", level=2)
    body(doc,
         "The US has 1.3M licensed attorneys. 75% work in firms of 1–10 lawyers (solo and small). "
         "This segment spends $3–5B annually on practice management software but has no AI-native "
         "option that combines drafting, research, client intake, and billing.")

    add_styled_table(doc,
        ["Segment", "Size", "ARPU Potential", "Umbrella Fit"],
        [
            ["Solo practitioners", "~400K", "$50–200/mo", "★★★★★ Primary"],
            ["Small firms (2–10)", "~100K firms", "$200–1,000/mo", "★★★★★ Primary"],
            ["Mid firms (10–50)", "~30K", "$1K–10K/mo", "★★★ Year 2"],
            ["BigLaw (50+)", "~4K", "Enterprise", "★★ Year 3"],
        ], [1.5, 1.2, 1.5, 1.3])

    heading(doc, "5.2 US Pricing Strategy", level=2)
    add_styled_table(doc,
        ["Plan", "Price (per seat/mo)", "Target User"],
        [
            ["Starter", "$50", "Solo · client portal + core OS"],
            ["Professional", "$200", "Copilot + advanced reporting"],
            ["Pro Plus", "$1,000", "High-volume AI practice"],
            ["Enterprise", "Contact sales", "SSO · data residency · SCIM"],
        ], [1.2, 1.5, 2.0])

    heading(doc, "5.3 US Go-to-Market Wedge", level=2)
    body(doc,
         "Do NOT lead with India features in the US. Lead with: (1) AI-powered client intake via Issue "
         "Checker, (2) matter management + billing, (3) US legal research, (4) US document drafting (GA October 2026). "
         "Position against Clio ($39–99/mo, no AI) not Harvey ($500+/mo, BigLaw only).")

    heading(doc, "5.4 US Competitive Landscape", level=2)
    add_styled_table(doc,
        ["Competitor", "Price", "AI Depth", "Weakness vs Umbrella"],
        [
            ["Clio", "$39–99/mo", "Basic AI add-on", "No AI-native workflows, no consumer lead gen"],
            ["MyCase", "$39–79/mo", "Minimal", "No drafting, no research"],
            ["Harvey", "$500+/mo", "Deep", "BigLaw only, inaccessible to solos"],
            ["CoCounsel (TR)", "Bundled", "Deep", "Westlaw dependency, expensive"],
            ["ChatGPT", "$20/mo", "General", "No legal verification, no firm OS"],
        ], [1.2, 1.0, 1.0, 2.3])

    heading(doc, "5.5 US Year 1 Approach — Seed, Don't Scale", level=2)
    bullet(doc, "Q3 2026: 10–20 friendly lawyers via founder network and legal tech Twitter.")
    bullet(doc, "Q4 2026: US drafting GA + Product Hunt launch. Target 50 US sign-ups.")
    bullet(doc, "Q1 2027: 3 legal tech podcast appearances. First 20 paying US firms.")
    bullet(doc, "Q2 2027: LinkedIn ad tests ($3K/mo) only if D7 retention > 40%.")
    bullet(doc, "Focused entry: solo criminal defense or immigration attorneys (high document volume).")

    page_break(doc)

    # ══════════════════════════════════════════════════════════════════════
    # 6. TECHNOLOGY
    # ══════════════════════════════════════════════════════════════════════
    heading(doc, "6. Product Strategy & Technology Roadmap")

    add_diagram(doc, diagram_paths[4], 6.5, "Figure 3: Technology architecture — current state and Year 1 target")

    heading(doc, "6.1 Product Pillars", level=2)
    add_styled_table(doc,
        ["Pillar", "Status", "India", "US", "Priority"],
        [
            ["India Drafting v1", "✅ Production", "✅", "N/A", "Maintain + improve"],
            ["Legal Research", "🟡 Partial", "✅", "✅", "P0 — citation confidence"],
            ["US Drafting", "🟡 Partial", "N/A", "🟡", "P0 — GA by Oct 2026"],
            ["Issue Checker", "✅ Production", "✅", "✅", "P0 — growth flywheel"],
            ["FIR Analysis", "✅ Production", "✅", "N/A", "P1 — India differentiator"],
            ["Document Review", "✅ Production", "✅", "✅", "P1"],
            ["Lawyer Leads Inbox", "✅ Production", "✅", "✅", "P0 — monetization loop"],
            ["Matter Management", "✅ Production", "✅", "✅", "P1"],
            ["Billing & Trust", "✅ Production", "✅", "✅", "P2"],
            ["AI Command Center", "🟡 Partial", "✅", "✅", "P1"],
            ["Mobile App (Flutter)", "✅ Production", "✅", "✅", "P0 — demo credibility"],
            ["SOC2 Compliance", "🟡 In progress", "—", "✅ Required", "P1 — US enterprise"],
        ], [1.5, 1.0, 0.7, 0.7, 1.8])

    heading(doc, "6.2 Engineering Roadmap — Year 1", level=2)
    add_styled_table(doc,
        ["Quarter", "Ship", "Owner", "GTM Unlock"],
        [
            ["Q3 2026", "Onboarding fix, welcome email + WhatsApp flow, push notifications", "CTO", "100 lawyer sprint"],
            ["Q3 2026", "Mobile drafting demo stable, lawyer leads WhatsApp alerts", "CTO", "Influencer credibility"],
            ["Q4 2026", "US drafting GA, citation verifier enforcement, Product Hunt ready", "CTO", "US beta launch"],
            ["Q4 2026", "Referral program in-app, Hindi onboarding video library", "CTO", "India scale"],
            ["Q1 2027", "Self-serve onboarding (no call required), Stripe US tax", "CTO", "Scale without founder bottleneck"],
            ["Q1 2027", "SOC2 Type I audit complete", "CTO", "US enterprise credibility"],
            ["Q2 2027", "Enterprise pilot (SSO, 10+ seats), API docs v1", "CTO", "First ₹3L+ / $5K+ deal"],
            ["Q2 2027", "US state-specific drafting templates (5 states)", "CTO", "US conversion lift"],
        ], [0.8, 2.5, 0.8, 1.5])

    heading(doc, "6.3 AI & Infrastructure Strategy", level=2)
    body(doc,
         "Umbrella uses a model router architecture — GPT-4o default, with per-task model selection "
         "and cost tracking via ai-usage-recorder. India drafting uses section-level generation with "
         "verification loops (unique moat). Research uses async workers on ai.high_priority queue.")

    bullet(doc, "Cost management: AI budget = 50–60% of subscription price allocated to model costs.")
    bullet(doc, "Credit system: transparent AI credit consumption per task; prevents margin erosion.")
    bullet(doc, "Quality gates: citation verifier must enforce confidence threshold before GA (Q4 2026).")
    bullet(doc, "Data: PostgreSQL multi-tenant, S3 document storage, Redis job queues.")
    bullet(doc, "Security: SOC2 path documented (CC6, CC7, CC8, CC9 controls in progress).")

    heading(doc, "6.4 Technical Debt & Launch Bug Remediation", level=2)
    body(doc,
         "Launch week bugs are expected. Priority zero items from July 5–8 launch feedback must be "
         "resolved before marketing scale. Rule: no new feature work until activation funnel drop-off "
         "point is fixed and D1 activation > 50%.")

    add_styled_table(doc,
        ["Category", "Examples", "Target Resolution"],
        [
            ["Signup / auth", "Google sign-up edge cases, email verification delays", "Jul 10"],
            ["Onboarding", "Profile completion confusion, plan selection UX", "Jul 12"],
            ["India drafting", "Generation timeout on long docs, mobile rendering", "Jul 15"],
            ["Credits / billing", "Credit error messages, trial expiry handling", "Jul 18"],
            ["Performance", "Cold start latency, research queue delays", "Jul 31"],
        ], [1.3, 2.5, 1.0])

    heading(doc, "6.5 Build vs Buy", level=2)
    add_styled_table(doc,
        ["Function", "Decision", "Rationale"],
        [
            ["Payments", "Stripe", "Global, subscriptions, tax handling"],
            ["Email", "Resend / SendGrid", "Transactional + drip campaigns"],
            ["Analytics", "Mixpanel or PostHog", "Funnel + cohort analysis"],
            ["CRM", "HubSpot free → paid", "US pipeline; India WhatsApp-first"],
            ["Support", "WhatsApp Business API", "India primary channel"],
            ["AI models", "OpenAI + Anthropic via router", "Best quality, cost-optimized per task"],
            ["Auth", "Custom + Google OAuth", "Multi-tenant, already built"],
        ], [1.2, 1.5, 2.8])

    page_break(doc)

    # Continue with GTM India, GTM US, execution plan, marketing, finance, fundraising...
    # I'll add substantial content for remaining sections

    heading(doc, "7. Go-to-Market — India (Year 1 Primary)")
    body(doc, "India is 70% of Year 1 effort. All channels are designed for practical execution by a 2-person founding team with ≤ ₹25L marketing budget.")

    heading(doc, "7.1 Positioning & Messaging", level=2)
    body(doc, "Primary message (Hinglish): 'India ke lawyers ke liye complete Legal OS — drafting, research, leads, mobile + web.'")
    body(doc, "Wedge CTA: 'Ek legal notice 2 minute mein. 30-day free trial.'")
    body(doc, "Never say: 'AI lawyer' or 'guaranteed win.' Always disclaim: legal information tool, not licensed advice.")

    heading(doc, "7.2 India Channel Strategy", level=2)
    add_styled_table(doc,
        ["Channel", "Q3", "Q4", "H1 2027", "Annual Spend", "CAC Target"],
        [
            ["Instagram/YouTube influencers", "₹1.5L", "₹3L", "₹6L", "₹10.5L", "₹800"],
            ["WhatsApp advocate networks", "₹0", "₹50K", "₹1L", "₹1.5L", "₹400"],
            ["Bar association / CLE events", "₹50K", "₹1.5L", "₹3L", "₹5L", "₹1,200"],
            ["Google Ads (brand + drafting)", "₹25K", "₹1L", "₹3L", "₹4.25L", "₹1,500"],
            ["Referral credits (₹500/ref)", "—", "₹50K", "₹2L", "₹2.5L", "₹500"],
            ["Content / SEO / YouTube", "₹25K", "₹75K", "₹1.5L", "₹2.5L", "Long-term"],
            ["Webinars (2/month)", "₹10K", "₹40K", "₹80K", "₹1.3L", "₹900"],
        ], [1.6, 0.6, 0.6, 0.7, 0.7, 0.8])

    heading(doc, "7.3 Influencer Operating Model", level=2)
    bullet(doc, "Tier 1 (5 creators, 50K+ followers): ₹3,000/reel + ₹500/firm subscription bonus")
    bullet(doc, "Tier 2 (15 creators, 10–50K): ₹3,000/reel — scripts in INFLUENCER-REEL-SCRIPTS-INDIA-3000.md")
    bullet(doc, "Tier 3 (30 creators, 3–10K): ₹2,000/reel from August — volume play")
    bullet(doc, "UTM: ?utm_source=CREATOR&utm_medium=influencer&utm_campaign=lawyer-reels")
    bullet(doc, "Approve before publish. Pay within 7 business days. Minimum 45–90 sec, 9:16, #Ad required.")

    heading(doc, "7.4 July Sprint — 100 Lawyers by July 20", level=2)
    add_styled_table(doc,
        ["Period", "Sign-ups Target", "Key Actions"],
        [
            ["Jul 8–10", "15", "Funnel audit, 30 influencer DMs, 10 WhatsApp groups"],
            ["Jul 11–14", "32", "Webinar, 5 reels live, 500 outbound DMs"],
            ["Jul 15–17", "36", "Influencer wave 2, law college workshop, social proof"],
            ["Jul 18–20", "17+", "IG Live, trial-to-paid nudge, final DM blitz"],
        ], [1.2, 1.0, 3.3])

    add_styled_table(doc,
        ["Channel", "Spend", "Sign-ups", "CAC"],
        [
            ["Micro-influencers (15 reels)", "₹45,000", "40", "₹1,125"],
            ["WhatsApp / Telegram", "₹0", "22", "₹0"],
            ["Direct outreach (500 DMs)", "₹0", "18", "₹0"],
            ["Webinars (2)", "₹10,000", "12", "₹833"],
            ["LinkedIn organic", "₹0", "8", "₹0"],
            ["TOTAL", "₹55,000", "100+", "~₹550"],
        ], [2.0, 0.9, 0.9, 0.8])

    page_break(doc)

    heading(doc, "8. Go-to-Market — United States (Year 1)")
    body(doc, "US is 30% of Year 1 effort, scaling to 50% in Year 2. Do not spend on US paid acquisition until US drafting is GA (October 2026) and D7 retention > 40%.")

    heading(doc, "8.1 US Channel Strategy", level=2)
    add_styled_table(doc,
        ["Channel", "Q3 2026", "Q4 2026", "H1 2027", "Annual Spend"],
        [
            ["Founder network / legal Twitter", "$0", "$500", "$2K", "$2.5K"],
            ["Legal tech podcasts (5 appearances)", "$0", "$1K", "$3K", "$4K"],
            ["Product Hunt launch (Oct)", "$0", "$300", "—", "$300"],
            ["ABA / state bar newsletters", "$0", "$500", "$2K", "$2.5K"],
            ["LinkedIn content (founder)", "$0", "$0", "$0", "$0"],
            ["LinkedIn ads (test, gated)", "—", "$500", "$5K", "$5.5K"],
            ["Legal tech conferences (1–2)", "—", "$1K", "$3K", "$4K"],
            ["US influencer/YouTube (legal)", "—", "$500", "$2K", "$2.5K"],
        ], [1.8, 0.8, 0.8, 0.8, 0.8])

    heading(doc, "8.2 US Launch Calendar", level=2)
    add_styled_table(doc,
        ["Date", "Event", "Target", "Owner"],
        [
            ["Jul 2026", "10 friendly US beta lawyers onboarded", "10 sign-ups", "Garima"],
            ["Oct 2026", "US drafting GA + Product Hunt", "50 sign-ups", "CTO + Garima"],
            ["Nov 2026", "First US case study published", "5 paying", "Garima"],
            ["Jan 2027", "Legal tech podcast tour (3 pods)", "25 sign-ups", "Garima"],
            ["Mar 2027", "ABA Techshow or equivalent", "50 cumulative paying", "Garima"],
            ["Jun 2027", "LinkedIn ad scale (if metrics pass)", "60 US paying", "Garima"],
        ], [1.0, 2.0, 1.0, 1.5])

    heading(doc, "8.3 US Messaging Framework", level=2)
    bullet(doc, "Headline: 'The AI-native practice platform for solo and small law firms.'")
    bullet(doc, "Sub: 'Client intake, AI drafting, research, matters, and billing — one platform.'")
    bullet(doc, "Proof: SOC2 in progress, 30-day free trial, no credit card required.")
    bullet(doc, "Competitive frame: 'Clio + AI + client leads. At half the price of Harvey.'")

    page_break(doc)

    heading(doc, "9. Year 1 Monthly & Weekly Execution Plan")

    add_diagram(doc, diagram_paths[7], 6.5, "Figure 4: MRR growth projection — India + US stacked")

    heading(doc, "9.1 Monthly Targets", level=2)
    add_styled_table(doc,
        ["Month", "New Sign-ups", "Cumulative", "Activated", "Paying", "MRR", "India %"],
        [
            ["Jul 2026", "100", "100", "60", "5", "$600", "85%"],
            ["Aug 2026", "120", "220", "140", "18", "$2,000", "80%"],
            ["Sep 2026", "150", "370", "230", "35", "$4,500", "78%"],
            ["Oct 2026", "180", "550", "340", "55", "$8,000", "75%"],
            ["Nov 2026", "200", "750", "450", "80", "$12,000", "72%"],
            ["Dec 2026", "220", "970", "560", "110", "$17,000", "70%"],
            ["Jan 2027", "250", "1,220", "680", "135", "$22,000", "68%"],
            ["Feb 2027", "270", "1,490", "800", "160", "$28,000", "65%"],
            ["Mar 2027", "290", "1,780", "920", "175", "$34,000", "63%"],
            ["Apr 2027", "310", "2,090", "1,020", "185", "$40,000", "60%"],
            ["May 2027", "330", "2,420", "1,080", "195", "$45,000", "58%"],
            ["Jun 2027", "350", "2,770", "1,150", "200", "$50,000", "55%"],
        ], [0.8, 0.7, 0.8, 0.7, 0.6, 0.7, 0.6])

    heading(doc, "9.2 Growth Phases", level=2)
    add_styled_table(doc,
        ["Phase", "Months", "Focus", "Team"],
        [
            ["Launch", "Jul–Aug", "Manual onboarding, India wedge, fix launch bugs", "2 founders"],
            ["Repeat", "Sep–Nov", "Influencer scale, US beta, leads loop", "2 founders + 1 marketing"],
            ["Scale", "Dec–Feb", "Paid tests, bar partnerships, SOC2", "4–5 people"],
            ["Expand", "Mar–Jun", "National India, US podcasts, seed fundraise", "6–8 people"],
        ], [0.8, 0.9, 2.5, 1.0])

    heading(doc, "9.3 Weekly Operating System", level=2)
    body(doc, "Monday 9:00 AM IST · 60 min Growth Meeting · Attendees: Both co-CEOs")
    add_styled_table(doc,
        ["#", "Agenda", "Time", "Output"],
        [
            ["1", "North Star: D7 activated retention", "10 min", "Keep / fix / kill decision"],
            ["2", "Funnel: sign-ups → activated → paid → churned", "15 min", "Top drop-off identified"],
            ["3", "Channel scorecard (UTM attribution)", "10 min", "Double down or pause channel"],
            ["4", "10 user call insights", "10 min", "1 product ticket created"],
            ["5", "Weekly targets by channel + owner", "10 min", "Assigned in todo tracker"],
            ["6", "Ship review + changelog", "5 min", "Public fix log updated"],
        ], [0.4, 2.2, 0.7, 1.5])

    page_break(doc)

    heading(doc, "10. Marketing Strategy, Channels & Budget")

    add_diagram(doc, diagram_paths[6], 5.0, "Figure 5: Year 1 exit revenue mix — India volume + US ARPU")

    heading(doc, "10.1 Total Marketing Budget — Year 1", level=2)
    add_styled_table(doc,
        ["Category", "Q3 2026", "Q4 2026", "H1 2027", "Annual Total"],
        [
            ["India marketing", "₹2.25L", "₹5.75L", "₹13.5L", "₹21.5L ($25K)"],
            ["US marketing", "₹10K", "₹2.5L", "₹8L", "₹10.6L ($12.5K)"],
            ["Events & conferences", "₹50K", "₹1.5L", "₹3L", "₹5L"],
            ["Tools (analytics, CRM, email)", "₹30K", "₹60K", "₹1.2L", "₹2.1L"],
            ["Content production", "₹25K", "₹75K", "₹1.5L", "₹2.5L"],
            ["Contingency (10%)", "₹33K", "₹1L", "₹2.7L", "₹4L"],
            ["TOTAL", "₹3.7L", "₹11.7L", "₹29.9L", "₹45.3L (~$53K)"],
        ], [1.8, 0.9, 0.9, 0.9, 1.0])

    body(doc, "Rule: Total marketing spend must remain below 30% of MRR until MRR exceeds $25K/month.", bold=True)

    heading(doc, "10.2 Brand & Content Strategy", level=2)
    bullet(doc, "Founder-led content: 3 posts/week (LinkedIn + Instagram). Garima = brand/story. CTO = product demos.")
    bullet(doc, "YouTube: 2 tutorials/month (India drafting, research, FIR analysis).")
    bullet(doc, "Case studies: 1/month from Month 3 (solo advocate, small firm, US solo).")
    bullet(doc, "Public changelog: weekly ship notes (builds trust post-launch bugs).")
    bullet(doc, "PR: legal tech media (Artificial Lawyer, Law Sites, Inc42 for India) — 1 story/quarter.")

    heading(doc, "10.3 Conversion Optimization", level=2)
    add_styled_table(doc,
        ["Funnel Step", "Current (est.)", "Target", "Tactic"],
        [
            ["Visit → sign-up", "3%", "8%", "Wedge landing page, social proof"],
            ["Sign-up → activated", "40%", "65%", "Onboarding call, single-workflow demo"],
            ["Activated → D7 return", "30%", "50%", "WhatsApp nudge, leads alert"],
            ["Trial → paid", "10%", "22%", "Day 7/14/25 sequences, price anchor"],
        ], [1.5, 1.0, 1.0, 2.0])

    add_diagram(doc, diagram_paths[5], 6.0, "Figure 6: Annual revenue funnel targets")

    page_break(doc)

    heading(doc, "11. Financial Model & Unit Economics")

    heading(doc, "11.1 Revenue Model Assumptions", level=2)
    add_styled_table(doc,
        ["Assumption", "Value", "Source"],
        [
            ["India ARPU (blended)", "₹2,000/seat/mo", "80% Starter, 15% Pro, 5% Pro Plus"],
            ["US ARPU (blended)", "$85/seat/mo", "70% Starter, 20% Pro, 10% Pro Plus"],
            ["Avg seats per paying firm", "2.5", "Industry benchmark"],
            ["Trial-to-paid (Month 1–3)", "12%", "Conservative"],
            ["Trial-to-paid (Month 6+)", "22%", "With onboarding optimization"],
            ["Monthly logo churn", "< 8%", "Target"],
            ["Net revenue retention", "> 105%", "Upsells + seat expansion"],
            ["AI cost as % of revenue", "35–45%", "Credit system controls"],
            ["Gross margin target", "55–65%", "After AI costs"],
        ], [2.0, 1.2, 1.5])

    heading(doc, "11.2 Year 1 P&L Summary (USD)", level=2)
    add_styled_table(doc,
        ["Line Item", "Q3 2026", "Q4 2026", "H1 2027", "Year 1 Total"],
        [
            ["Revenue (MRR × avg)", "$8K", "$42K", "$210K", "$260K"],
            ["AI / infrastructure COGS", "$3.5K", "$18K", "$85K", "$106K"],
            ["Gross profit", "$4.5K", "$24K", "$125K", "$154K"],
            ["Marketing", "$4.4K", "$14K", "$34K", "$52K"],
            ["Salaries (founders + hires)", "$0*", "$8K", "$60K", "$68K"],
            ["Tools & ops", "$1K", "$3K", "$8K", "$12K"],
            ["Net profit / (loss)", "($0.9K)", "($1K)", "$23K", "$22K"],
        ], [1.8, 0.9, 0.9, 0.9, 1.0])
    body(doc, "* Founders at zero salary through Q3 2026. First hire (India marketing) in September at ₹60K/mo.", italic=True)

    heading(doc, "11.3 Unit Economics Target (Month 12)", level=2)
    add_styled_table(doc,
        ["Metric", "India", "US", "Blended"],
        [
            ["CAC", "₹900 ($11)", "$120", "$35"],
            ["LTV (24-mo, 8% churn)", "₹38,000", "$1,800", "$620"],
            ["LTV:CAC", "42:1", "15:1", "18:1"],
            ["Payback period", "1.5 months", "2.5 months", "2 months"],
            ["Gross margin", "60%", "58%", "59%"],
        ], [1.5, 1.2, 1.0, 1.0])

    heading(doc, "11.4 Cash Flow & Runway", level=2)
    body(doc,
         "Pre-fundraise: founders bootstrap through Q3 2026 on ≤ $5K/month burn (marketing only). "
         "Angel round ($150–300K) in Q4 2026 extends runway to 18 months. Seed ($1.5–2.5M Base / "
         "$3–5M Scale) in Q1 2027 funds US GTM scale and team growth.")

    heading(doc, "11.5 Dual Scenario 3-Year Model", level=2)
    body(doc,
         "The full 3-year model lives in UMBRELLA-3-YEAR-FINANCIAL-MODEL.xlsx. Set Assumptions!B5 to "
         "'Base' (original MRR plan) or 'Scale' ($50M ARR path). Revenue, headcount, OpEx, P&L, "
         "cash flow, and dividends recalculate via Excel formulas — not hardcoded values.")
    add_styled_table(doc,
        ["Exit metric", "Base Plan", "Scale Plan"],
        [
            ["Y1 MRR (Jun 2027)", "$50K", "$175K"],
            ["Y2 MRR (Jun 2028)", "$200K", "$1.25M"],
            ["Y3 MRR (Jun 2029)", "$500K", "$4.17M"],
            ["Y3 ARR", "$6M", "$50M"],
        ], [1.5, 1.2, 1.2])

    add_styled_table(doc,
        ["Period", "Starting Cash", "Revenue", "Expenses", "Ending Cash", "Runway"],
        [
            ["Q3 2026", "$20K", "$8K", "$10K", "$18K", "5 months"],
            ["Q4 2026 (+ angels)", "$18K", "$42K", "$35K", "$225K*", "18 months"],
            ["H1 2027 (+ seed)", "$225K", "$210K", "$180K", "$1.8M*", "24+ months"],
        ], [1.0, 0.9, 0.8, 0.9, 0.9, 0.9])
    body(doc, "* Assumes angel round closes Oct 2026 ($200K) and seed closes Mar 2027 ($2M).", italic=True)

    page_break(doc)

    heading(doc, "12. Fundraising Strategy & Use of Funds")

    add_diagram(doc, diagram_paths[3], 6.5, "Figure 7: Fundraising timeline and triggers")

    heading(doc, "12.1 Funding Rounds", level=2)
    add_styled_table(doc,
        ["Round", "Timing", "Amount", "Valuation", "Trigger"],
        [
            ["Bootstrap", "Now", "$0", "—", "Product live, fixing bugs"],
            ["Friends & Family / Angels", "Oct 2026", "$150–300K", "$3–5M", "100+ lawyers, $5K MRR"],
            ["Seed", "Mar 2027", "$1.5–2.5M (Base) / $3–5M (Scale)", "$12–18M", "$25K MRR (Base) / $100K+ (Scale)"],
            ["Series A", "Q1 2028", "$8–12M (Base) / $25M (Scale)", "$50–80M / $200M+", "$150K MRR (Base) / $500K+ (Scale)"],
            ["Series B", "Q1 2029", "— (Base) / $50M (Scale)", "— / $500M+", "$500K MRR (Base) / $3M+ (Scale)"],
        ], [1.2, 1.0, 1.0, 1.0, 2.3])

    heading(doc, "12.2 Use of Funds — Seed ($2M scenario)", level=2)
    add_styled_table(doc,
        ["Category", "%", "Amount", "Purpose"],
        [
            ["Engineering (incl. AI)", "40%", "$800K", "US drafting, SOC2, mobile, enterprise"],
            ["US GTM", "25%", "$500K", "US BD hire, conferences, ads, content"],
            ["India GTM", "15%", "$300K", "Influencer scale, bar partnerships, events"],
            ["Operations & CS", "10%", "$200K", "Customer success, support, tools"],
            ["G&A / legal / compliance", "5%", "$100K", "Incorporation, IP, SOC2 audit"],
            ["Reserve", "5%", "$100K", "Contingency"],
        ], [1.8, 0.6, 0.8, 2.3])

    heading(doc, "12.3 Investor Narrative", level=2)
    body(doc, "One-liner: 'Umbrella is the AI-native Legal OS — starting with India's 600K advocates, expanding to America's 1.3M attorneys, then the world.'")
    bullet(doc, "Why now: AI makes legal practice automation commercially viable for the first time.")
    bullet(doc, "Why us: Only platform with India-verified drafting + consumer-to-lawyer lead flywheel + full firm OS.")
    bullet(doc, "Traction: [update with live metrics before each investor meeting].")
    bullet(doc, "Market: $800B legal services → $28B legal tech → AI-native is fastest-growing segment.")
    bullet(doc, "Business model: SaaS per-seat + AI credits + consumer subscriptions. 60% gross margin.")
    bullet(doc, "Competition: Not Clio (no AI). Not Harvey (no solos). Not ChatGPT (no verification, no OS).")
    bullet(doc, "Vision: Every lawyer in the world runs their practice on Umbrella.")

    heading(doc, "12.4 Target Investor Profiles", level=2)
    add_styled_table(doc,
        ["Type", "Examples", "Angle", "When"],
        [
            ["Legal tech angels", "Former Clio/MyCase execs", "Category expertise", "Angels Oct 2026"],
            ["India SaaS angels", "SaaS founders, Matrix/Accel angels", "India GTM", "Angels Oct 2026"],
            ["Accelerators", "Techstars, industry programs", "Network + credibility", "Apply Sep 2026"],
            ["Seed VCs (US)", "Bessemer, Index, a16z Speedrun", "US expansion", "Seed Mar 2027"],
            ["Seed VCs (India)", "Blume, Stellaris, Prime Venture", "India depth", "Seed Mar 2027"],
        ], [1.2, 1.8, 1.5, 1.0])

    page_break(doc)

    heading(doc, "13. Organization, Governance & Operating Model")

    add_diagram(doc, diagram_paths[2], 6.5, "Figure 8: Year 1 organization structure")

    heading(doc, "13.1 Hiring Plan (Metric-Triggered)", level=2)
    add_styled_table(doc,
        ["Role", "Start", "Cost/mo", "Trigger", "Reports To"],
        [
            ["India Marketing Manager", "Sep 2026", "₹60K", "200+ activated lawyers", "Garima"],
            ["Customer Success (PT)", "Nov 2026", "₹40K", "50+ paying firms", "Garima"],
            ["US BD (contract)", "Jan 2027", "$3K", "20+ US beta users", "Garima"],
            ["Backend Engineer", "Mar 2027", "₹1.2L", "Post-seed close", "CTO"],
            ["Content / Influencer Coord", "Mar 2027", "₹50K", "30+ active influencers", "Garima"],
        ], [1.8, 0.8, 0.8, 1.5, 0.8])

    heading(doc, "13.2 Decision Rights", level=2)
    add_styled_table(doc,
        ["Decision", "Owner", "Consult", "Veto"],
        [
            ["Product roadmap priority", "CTO", "Garima", "Either co-CEO"],
            ["Marketing spend > $1K", "Garima", "CTO", "Either co-CEO"],
            ["Pricing changes", "Garima", "CTO", "Both must agree"],
            ["Fundraising / cap table", "Garima", "CTO", "Both must agree"],
            ["Engineering hires", "CTO", "Garima", "—"],
            ["GTM hires", "Garima", "CTO", "—"],
            ["Geographic expansion", "Both", "—", "Both must agree"],
        ], [1.8, 1.0, 1.0, 1.5])

    heading(doc, "13.3 Governance", level=2)
    bullet(doc, "Monthly board update (even pre-board): metrics, burn, hires, risks.")
    bullet(doc, "Quarterly plan review: adjust targets based on actuals.")
    bullet(doc, "Cap table: equal co-founder split recommended; 10–15% ESOP pool at seed.")
    bullet(doc, "IP: all code and brand owned by Okay Legal entity.")

    page_break(doc)

    heading(doc, "14. Risk Management & Contingency Plans")
    add_styled_table(doc,
        ["Risk", "Likelihood", "Impact", "Mitigation", "Owner"],
        [
            ["Launch bugs erode trust", "High", "High", "Public changelog + white-glove onboarding", "CTO"],
            ["100 sign-ups, low activation", "Medium", "High", "Mandatory onboarding call; wedge demo", "Garima"],
            ["US product not ready", "High", "Medium", "Delay US paid spend until Oct GA", "CTO"],
            ["Trial users don't convert", "Medium", "High", "Day 7/14/25 sequences; price anchor", "Garima"],
            ["AI costs exceed revenue", "Medium", "High", "Credit system caps; model router optimization", "CTO"],
            ["Influencer low quality", "Medium", "Medium", "Approve before pay; UTM-only attribution", "Garima"],
            ["Fundraise fails / delays", "Low", "High", "Bootstrap longer; reduce burn; angel first", "Garima"],
            ["Competitor moves downmarket", "Medium", "Medium", "India depth + leads flywheel moat", "Both"],
            ["Regulatory (AI + legal)", "Low", "High", "Disclaimers; not licensed advice; SOC2", "Both"],
            ["Founder burnout", "Medium", "High", "Strict role split; first hire Sep 2026", "Both"],
        ], [1.8, 0.7, 0.7, 2.2, 0.8])

    page_break(doc)

    heading(doc, "15. KPI Dashboard & Reporting Cadence")
    add_styled_table(doc,
        ["Metric", "Jul 20", "Dec 2026", "Jun 2027", "Tool"],
        [
            ["Lawyer sign-ups (weekly)", "50+/wk", "55/wk", "70/wk", "Admin + UTM sheet"],
            ["Activation rate", "> 60%", "> 55%", "> 50%", "PostHog / Mixpanel"],
            ["D7 retention (activated)", "> 45%", "> 50%", "> 55%", "Cohort sheet"],
            ["Trial → paid conversion", "> 10%", "> 18%", "> 22%", "Stripe + admin"],
            ["MRR", "$600", "$17K", "$50K", "Stripe"],
            ["India MRR %", "85%", "70%", "55%", "Stripe"],
            ["Lawyer leads / month", "10", "80", "200", "Leads inbox"],
            ["CAC (blended)", "< ₹1,200", "< ₹900", "< ₹700", "UTM sheet"],
            ["Support response time", "< 2 hrs", "< 1 hr", "< 30 min", "WhatsApp SLA"],
            ["NPS (quarterly)", "—", "> 40", "> 50", "Typeform"],
        ], [1.8, 1.0, 1.0, 1.0, 1.5])

    page_break(doc)

    # ══════════════════════════════════════════════════════════════════════
    # 16. CTO TODOS
    # ══════════════════════════════════════════════════════════════════════
    heading(doc, "16. Role Assignments — Co-CEO / CTO (Engineering)")

    body(doc, "Accountability: Product, technology, AI, infrastructure, India product depth, engineering hires.")
    body(doc, "Review cadence: Daily standup (15 min) · Weekly ship review (Friday) · Monthly roadmap review.")

    heading(doc, "16.1 Immediate — July 8–20 Sprint", level=2)
    add_styled_table(doc,
        ["#", "Task", "Deadline", "Status"],
        [
            ["T-1", "Audit signup → activation funnel; fix top drop-off", "Jul 10", "☐"],
            ["T-2", "Set up UTM tracking in admin dashboard + metrics sheet", "Jul 9", "☐"],
            ["T-3", "Fix Google sign-up edge cases (issue-checker inline sign-up)", "Jul 10", "☐"],
            ["T-4", "Welcome email + WhatsApp flow on lawyer sign-up", "Jul 11", "☐"],
            ["T-5", "Add Calendly onboarding link to /for-lawyers + welcome email", "Jul 10", "☐"],
            ["T-6", "Record 2-min Loom: legal notice drafting demo for WhatsApp groups", "Jul 9", "☐"],
            ["T-7", "Mobile drafting demo stable for influencer reels", "Jul 12", "☐"],
            ["T-8", "Public changelog page — 'What we fixed since launch'", "Jul 11", "☐"],
            ["T-9", "Lawyer leads inbox: email + push notification on new lead", "Jul 15", "☐"],
            ["T-10", "Join 3 onboarding calls/day to observe friction", "Jul 8–20", "☐"],
        ], [0.4, 3.0, 0.8, 0.5])

    heading(doc, "16.2 Monthly Todos — Q3 2026 (Jul–Sep)", level=2)
    add_styled_table(doc,
        ["Month", "Task", "Success Criteria"],
        [
            ["Jul", "Fix all P0 launch bugs", "D1 activation > 50%"],
            ["Jul", "Onboarding call insights → 4 product fixes", "Activation 60%+"],
            ["Aug", "India drafting: timeout fix + long doc handling", "< 5% generation failures"],
            ["Aug", "Research: citation confidence threshold enforced", "Verified citations > 90%"],
            ["Aug", "PostHog/Mixpanel funnel analytics live", "All funnel steps tracked"],
            ["Sep", "US drafting: first beta for 10 US lawyers", "5 US drafts completed"],
            ["Sep", "Lawyer leads WhatsApp alert integration", "80% leads opened < 1 hr"],
            ["Sep", "SOC2: CC6 access controls evidence collection", "Audit prep 30% complete"],
        ], [0.7, 2.5, 1.5])

    heading(doc, "16.3 Monthly Todos — Q4 2026 (Oct–Dec)", level=2)
    add_styled_table(doc,
        ["Month", "Task", "Success Criteria"],
        [
            ["Oct", "US drafting GA (5 document types)", "US beta NPS > 30"],
            ["Oct", "Product Hunt launch tech prep", "Zero downtime launch day"],
            ["Nov", "Referral program (in-app, ₹500 credit)", "20 referrals in month 1"],
            ["Nov", "Hindi onboarding video library (5 workflows)", "Activation lift + 10%"],
            ["Dec", "Self-serve onboarding v1 (no call required)", "50% self-serve activation"],
            ["Dec", "SOC2 Type I audit", "Audit complete"],
        ], [0.7, 2.5, 1.5])

    heading(doc, "16.4 Monthly Todos — H1 2027 (Jan–Jun)", level=2)
    add_styled_table(doc,
        ["Month", "Task", "Success Criteria"],
        [
            ["Jan", "Enterprise pilot: SSO for 10+ seat firm", "1 enterprise LOI signed"],
            ["Feb", "US state templates (CA, NY, TX, FL, IL)", "US conversion + 5%"],
            ["Mar", "Backend engineer hire (post-seed)", "Engineer onboarded"],
            ["Apr", "API docs v1 + developer portal", "3 integration partners"],
            ["May", "India drafting v2 feature flag → production", "Generation quality + 15%"],
            ["Jun", "Performance: sub-3s page loads globally", "Lighthouse score > 90"],
        ], [0.7, 2.5, 1.5])

    heading(doc, "16.5 Ongoing Weekly Cadence (CTO)", level=2)
    bullet(doc, "Monday: Review funnel data; assign 2 engineering tasks for the week.")
    bullet(doc, "Tuesday–Thursday: Ship 1 fix or feature per day. No meetings before 2 PM.")
    bullet(doc, "Friday: Publish changelog. Demo to Garima. 3 onboarding calls.")
    bullet(doc, "Daily: Monitor error rates, support tickets, generation failures.")

    page_break(doc)

    # ══════════════════════════════════════════════════════════════════════
    # 17. GARIMA TODOS
    # ══════════════════════════════════════════════════════════════════════
    heading(doc, "17. Role Assignments — Garima (Co-CEO / CFO / CMO)")

    body(doc, "Accountability: Finance, fundraising, marketing, sales, US GTM, operations, customer success, GTM hires.")
    body(doc, "Review cadence: Daily marketing check (30 min) · Weekly growth meeting (Monday) · Monthly financial review.")

    heading(doc, "17.1 Immediate — July 8–20 Sprint", level=2)
    add_styled_table(doc,
        ["#", "Task", "Deadline", "Status"],
        [
            ["G-1", "Create metrics Google Sheet (UTM + funnel + daily tracker)", "Jul 9", "☐"],
            ["G-2", "DM 30 influencers with reel scripts doc attached", "Jul 10", "☐"],
            ["G-3", "Book 10 influencers for reels by Jul 12", "Jul 11", "☐"],
            ["G-4", "Post Loom demo in 10 WhatsApp lawyer groups", "Jul 10", "☐"],
            ["G-5", "Book Jul 11 webinar: 'Legal Notice in 2 Minutes' (Zoom + landing)", "Jul 9", "☐"],
            ["G-6", "Founder LinkedIn post: launch story + 60-sec demo", "Jul 9", "☐"],
            ["G-7", "Set up WhatsApp Business support number on /for-lawyers", "Jul 10", "☐"],
            ["G-8", "Approve and publish first 5 influencer reels", "Jul 12", "☐"],
            ["G-9", "Personal WhatsApp welcome to every new lawyer sign-up", "Jul 8–20", "☐"],
            ["G-10", "Outreach to 10 US lawyers from warm network", "Jul 15", "☐"],
            ["G-11", "Set up Stripe revenue dashboard + weekly MRR email", "Jul 10", "☐"],
            ["G-12", "Draft angel investor one-pager (1 page)", "Jul 18", "☐"],
        ], [0.4, 3.0, 0.8, 0.5])

    heading(doc, "17.2 Monthly Todos — Q3 2026 (Jul–Sep)", level=2)
    add_styled_table(doc,
        ["Month", "Task", "Success Criteria"],
        [
            ["Jul", "100 lawyer sign-ups by Jul 20", "100 sign-ups, 60 activated"],
            ["Jul", "Influencer program: 10 reels live", "40 sign-ups from influencers"],
            ["Aug", "Own Delhi NCR as first city (50 activated)", "50 Delhi lawyers activated"],
            ["Aug", "Onboard 10 US beta lawyers", "10 US sign-ups"],
            ["Aug", "Financial model in spreadsheet (actuals vs plan)", "Monthly P&L tracked"],
            ["Sep", "Hire India Marketing Manager", "Hired by Sep 15"],
            ["Sep", "Apply to relevant accelerators", "3 applications submitted"],
            ["Sep", "First bar association webinar (Delhi or Mumbai)", "50 attendees, 10 sign-ups"],
            ["Sep", "Angel investor outreach: 20 conversations", "5 interested angels"],
        ], [0.7, 2.5, 1.5])

    heading(doc, "17.3 Monthly Todos — Q4 2026 (Oct–Dec)", level=2)
    add_styled_table(doc,
        ["Month", "Task", "Success Criteria"],
        [
            ["Oct", "Close angel round ($150–300K)", "Cash in bank"],
            ["Oct", "Product Hunt launch (US drafting GA)", "Top 5 of the day"],
            ["Oct", "Influencer Tier 3 scale (30 creators)", "100 sign-ups from influencers"],
            ["Nov", "First US case study published", "5 US paying firms"],
            ["Nov", "Hire Customer Success (part-time)", "Hired by Nov 15"],
            ["Nov", "Trial-to-paid email sequences (Day 7/14/25)", "Conversion + 5%"],
            ["Dec", "110 cumulative paying firms", "$17K MRR"],
            ["Dec", "Seed deck v1 + data room", "Ready for Mar 2027 fundraise"],
            ["Dec", "First enterprise pilot conversation (India, 10+ seats)", "LOI or pilot signed"],
        ], [0.7, 2.5, 1.5])

    heading(doc, "17.4 Monthly Todos — H1 2027 (Jan–Jun)", level=2)
    add_styled_table(doc,
        ["Month", "Task", "Success Criteria"],
        [
            ["Jan", "Legal tech podcast tour (3 appearances)", "25 US sign-ups"],
            ["Jan", "Hire US BD contractor", "20 US outreaches/week"],
            ["Feb", "Close seed round ($1.5–2.5M)", "Cash in bank"],
            ["Mar", "ABA Techshow or equivalent conference", "50 qualified leads"],
            ["Apr", "LinkedIn ad test ($3K/mo) — only if D7 > 40%", "CAC < $120"],
            ["May", "India bar association annual sponsorship (1 state)", "100 sign-ups from event"],
            ["Jun", "200 cumulative paying · $50K MRR", "Seed metrics hit"],
            ["Jun", "Series A prep: deck, metrics, US revenue story", "Data room ready"],
        ], [0.7, 2.5, 1.5])

    heading(doc, "17.5 Ongoing Weekly Cadence (Garima)", level=2)
    bullet(doc, "Monday: Lead growth meeting. Update metrics sheet. Set channel targets.")
    bullet(doc, "Tuesday: 2 influencer reels go live. 50 outbound DMs to lawyers.")
    bullet(doc, "Wednesday: 5 lawyer user calls. Trial conversion nudges.")
    bullet(doc, "Thursday: Webinar or demo. US community engagement.")
    bullet(doc, "Friday: MRR report. Approve influencer payments. Social proof post.")
    bullet(doc, "Saturday: Founder content (reel or LinkedIn).")
    bullet(doc, "Daily: WhatsApp support (< 2 hr response). Welcome every new sign-up.")

    heading(doc, "17.6 Financial Responsibilities (Garima as CFO)", level=2)
    bullet(doc, "Weekly: MRR, burn rate, cash balance update.")
    bullet(doc, "Monthly: P&L actual vs plan. CAC by channel. LTV cohort analysis.")
    bullet(doc, "Quarterly: Board update. Fundraise progress. Budget reforecast.")
    bullet(doc, "Ongoing: Stripe reconciliation. Vendor payments. Cap table management.")
    bullet(doc, "Pre-seed: incorporate if not done, IP assignment, founder agreements, ESOP plan draft.")

    page_break(doc)

    heading(doc, "18. Years 2–3 Preview — Global Expansion")
    body(doc,
         "Two scenarios drive Year 2–3 planning. Base Plan is conservative and seed-ready. "
         "Scale Plan targets $50M ARR and requires Series A ($25M) and Series B ($50M). "
         "See Section 3.0 and the Excel model (Assumptions!B5 toggle).")

    heading(doc, "18.1 Year 2 — US Heavy (Jul 2027 – Jun 2028)", level=2)
    add_styled_table(doc,
        ["Metric", "Base Plan", "Scale Plan"],
        [
            ["MRR (Jun 2028)", "$200K", "$1.25M"],
            ["ARR run-rate", "$2.4M", "$15M"],
            ["Paying firms", "600", "3,000+"],
            ["US revenue %", "55%", "60%"],
            ["India revenue %", "30%", "25%"],
            ["UK/CA/AU revenue %", "15%", "15%"],
            ["Team size", "15–20", "80–100"],
            ["Funding", "Series A $8–12M", "Series A $25M"],
        ], [2.0, 1.25, 1.25])

    heading(doc, "18.2 Year 3 — Rest of World (Jul 2028 – Jun 2029)", level=2)
    add_styled_table(doc,
        ["Metric", "Base Plan", "Scale Plan"],
        [
            ["MRR (Jun 2029)", "$500K", "$4.17M"],
            ["ARR run-rate", "$6M", "$50M"],
            ["Paying firms", "2,000+", "15,000+"],
            ["Countries live", "15+", "20+"],
            ["Team size", "40–50", "150–200"],
            ["Funding", "Series A deployed", "Series B $50M"],
        ], [2.0, 1.25, 1.25])

    body(doc, "Year 3 regions (sequential): UK (Y2 carry) → EU (Germany, France) → LATAM (Mexico, Brazil) → APAC (Singapore, Japan) → MENA (UAE). Each requires localized drafting engine + data residency assessment.")

    page_break(doc)

    # ══════════════════════════════════════════════════════════════════════
    # APPENDICES
    # ══════════════════════════════════════════════════════════════════════
    heading(doc, "Appendix A: Competitive Landscape (Summary)")
    add_styled_table(doc,
        ["Company", "Focus", "Funding", "Threat Level", "Our Advantage"],
        [
            ["Clio", "US practice management", "$900M+ raised", "Medium (US)", "AI-native, India depth, lead gen"],
            ["Harvey", "BigLaw AI", "$100M+", "Low (downmarket)", "Solo/small firm pricing"],
            ["Casetext/CoCounsel", "US research", "Acquired", "Medium (US)", "Full OS, not just research"],
            ["CaseMine", "India research", "Bootstrapped", "Low", "AI drafting + OS, not just research"],
            ["Vakilsearch", "India consumer", "VC-backed", "Low", "Lawyer-focused, not consumer"],
            ["ChatGPT", "General AI", "OpenAI", "High (awareness)", "Verified citations, firm OS, leads"],
        ], [1.2, 1.3, 1.0, 1.0, 1.8])

    heading(doc, "Appendix B: Product Feature Inventory (Summary)")
    add_styled_table(doc,
        ["Feature", "Status", "Route / Entry Point"],
        [
            ["India Drafting v1", "✅ Production", "/app/india-drafting/draft"],
            ["Legal Research", "🟡 Partial", "/app/research"],
            ["US Drafting", "🟡 Partial", "/app/us-drafting"],
            ["Issue Checker", "✅ Production", "/legal-issue-checker"],
            ["FIR Analysis", "✅ Production", "/app/fir-analysis"],
            ["Document Review", "✅ Production", "/app/document-review"],
            ["Lawyer Leads Inbox", "✅ Production", "/app/leads"],
            ["AI Command Center", "🟡 Partial", "/app/ai-command-center"],
            ["Matters", "✅ Production", "/app/matters"],
            ["Billing", "✅ Production", "/app/billing"],
            ["Mobile App", "✅ Production", "iOS + Android (Flutter)"],
        ], [1.8, 1.0, 2.0])

    heading(doc, "Appendix C: Key URLs & Assets")
    bullets_urls = [
        "Home: https://umbrella.okaylegal.ai",
        "For Lawyers: https://umbrella.okaylegal.ai/for-lawyers",
        "Sign-up: https://umbrella.okaylegal.ai/auth/sign-up",
        "Pricing: https://umbrella.okaylegal.ai/pricing",
        "Issue Checker: https://umbrella.okaylegal.ai/legal-issue-checker",
        "Demo: https://umbrella.okaylegal.ai/demo",
        "Influencer UTM: ?utm_source=NAME&utm_medium=influencer&utm_campaign=lawyer-reels",
        "Influencer scripts: docs/marketing/INFLUENCER-REEL-SCRIPTS-INDIA-3000.md",
        "Engineering handbook: docs/umbrella-engineering-handbook/",
        "Feature inventory: docs/feature-inventory.md",
    ]
    for u in bullets_urls:
        bullet(doc, u)

    page_break(doc)

    heading(doc, "Appendix E: Monthly Revenue Build-Up (USD)")
    body(doc, "Detailed month-by-month revenue projection for financial planning and investor updates.")
    add_styled_table(doc,
        ["Month", "India Paying", "US Paying", "India MRR", "US MRR", "Total MRR"],
        [
            ["Jul 2026", "4", "1", "$400", "$200", "$600"],
            ["Aug 2026", "14", "4", "$1,400", "$600", "$2,000"],
            ["Sep 2026", "27", "8", "$2,800", "$1,700", "$4,500"],
            ["Oct 2026", "42", "13", "$4,500", "$3,500", "$8,000"],
            ["Nov 2026", "60", "20", "$6,500", "$5,500", "$12,000"],
            ["Dec 2026", "80", "30", "$9,000", "$8,000", "$17,000"],
            ["Jan 2027", "95", "40", "$11,000", "$11,000", "$22,000"],
            ["Feb 2027", "110", "50", "$13,500", "$14,500", "$28,000"],
            ["Mar 2027", "120", "55", "$16,000", "$18,000", "$34,000"],
            ["Apr 2027", "128", "57", "$18,500", "$21,500", "$40,000"],
            ["May 2027", "135", "60", "$21,000", "$24,000", "$45,000"],
            ["Jun 2027", "140", "60", "$27,000", "$21,000", "$50,000"],
        ], [0.9, 0.9, 0.9, 0.9, 0.9, 0.9])

    heading(doc, "Appendix F: Weekly Channel Scorecard Template")
    body(doc, "Copy this table into the metrics Google Sheet. Update every Monday.")
    add_styled_table(doc,
        ["Channel", "Spend (wk)", "Sign-ups", "Activated", "Paid", "CAC", "Notes"],
        [
            ["Influencer (Instagram/YT)", "—", "—", "—", "—", "—", "—"],
            ["WhatsApp / Telegram", "—", "—", "—", "—", "—", "—"],
            ["Direct outreach (DM)", "—", "—", "—", "—", "—", "—"],
            ["Webinar / event", "—", "—", "—", "—", "—", "—"],
            ["LinkedIn organic", "—", "—", "—", "—", "—", "—"],
            ["Google Ads", "—", "—", "—", "—", "—", "—"],
            ["Referral", "—", "—", "—", "—", "—", "—"],
            ["US network / podcast", "—", "—", "—", "—", "—", "—"],
            ["Organic / direct", "—", "—", "—", "—", "—", "—"],
            ["TOTAL", "—", "—", "—", "—", "—", "—"],
        ], [1.3, 0.7, 0.7, 0.7, 0.6, 0.6, 1.5])

    heading(doc, "Appendix G: Investor FAQ (Pre-Seed / Seed)")
    faqs = [
        ("Why India first?", "India has 600K+ practicing advocates, no AI-native legal OS, and our India drafting engine is production-ready with IPC/CrPC verification. It's the fastest path to volume and product iteration."),
        ("Why not Africa?", "Deliberate focus. Year 1 is India + US only. Africa adds distraction without proportional ARPU. Year 3+ may include select markets after core economics are proven."),
        ("How do you compete with ChatGPT?", "ChatGPT gives unverified text. Umbrella gives section-verified India drafts with statute citations, a full firm OS, and a consumer lead pipeline. Lawyers pay for trust and workflow, not text generation."),
        ("What's the moat?", "Three layers: (1) India drafting verification pipeline, (2) consumer-to-lawyer lead flywheel, (3) full firm OS with matters, billing, and mobile. No competitor has all three."),
        ("What's the business model?", "SaaS per-seat subscriptions (₹1,400–30,000 India; $50–1,000 US) plus AI credit packs and consumer Plus subscriptions."),
        ("What are the unit economics?", "Target LTV:CAC of 18:1 blended. India CAC ~₹900, US CAC ~$120. Gross margin 55–65% after AI costs."),
        ("How much are you raising?", "Base: Angels $150–300K (Oct 2026), Seed $1.5–2.5M (Mar 2027), Series A $8–12M (2028). Scale: Seed $3–5M, Series A $25M, Series B $50M."),
        ("What will you do with seed money?", "40% engineering, 25% US GTM, 15% India GTM, 10% ops/CS, 5% G&A, 5% reserve."),
        ("Who are the founders?", "Co-CEO/CTO (engineering, product, AI) and Garima (co-CEO/CFO/CMO — finance, marketing, sales, operations)."),
        ("What's the 3-year vision?", "Base: $6M ARR by Year 3 (original MRR plan). Scale: $50M ARR via US enterprise + India volume + global expansion. Both: India + US Year 1, US-heavy Year 2, global Year 3."),
    ]
    for q, a in faqs:
        p = doc.add_paragraph()
        r = p.add_run(f"Q: {q}")
        r.bold = True
        r.font.size = Pt(10)
        r.font.color.rgb = NAVY
        body(doc, f"A: {a}")

    page_break(doc)

    heading(doc, "Appendix H: Detailed Weekly Plan — Q3 2026")
    body(doc, "Week-by-week execution for July through September. Owner: both co-CEOs.")

    weeks_q3 = [
        ("Week Jul 8–13", "100-lawyer sprint (phase 1)", "CTO: funnel fix, Loom, onboarding. Garima: 30 influencer DMs, webinar, WhatsApp groups.", "40 sign-ups"),
        ("Week Jul 14–20", "100-lawyer sprint (phase 2)", "CTO: leads notifications. Garima: influencer wave 2, IG Live, conversion nudges.", "100 total"),
        ("Week Jul 21–27", "Activation blitz", "CTO: research citation fix. Garima: call every non-activated user. Publish 2 testimonials.", "20 new, 70% activation"),
        ("Week Jul 28–Aug 3", "Delhi NCR atomic start", "CTO: PostHog live. Garima: 5 Delhi bar association contacts. 3 influencer reels.", "25 new (Delhi focus)"),
        ("Week Aug 4–10", "Influencer Tier 2 scale", "CTO: mobile demo polish. Garima: onboard 10 US betas. 5 reels.", "30 new"),
        ("Week Aug 11–17", "Webinar series #2", "CTO: drafting timeout fix. Garima: 'FIR Analysis' webinar. Law college outreach.", "30 new"),
        ("Week Aug 18–24", "Delhi NCR push", "CTO: referral program spec. Garima: Delhi advocate association event. 50 Delhi activated target.", "25 new"),
        ("Week Aug 25–31", "Month-end conversion", "CTO: ship referral v0. Garima: trial-to-paid push. MRR $2K target.", "15 new, 18 paying"),
        ("Week Sep 1–7", "US beta expansion", "CTO: US drafting beta. Garima: hire marketing manager. Accelerator applications.", "30 new"),
        ("Week Sep 8–14", "Bar association webinar", "CTO: US draft feedback iteration. Garima: first bar webinar. Angel deck draft.", "35 new"),
        ("Week Sep 15–21", "Marketing manager onboarded", "CTO: leads WhatsApp alerts. Garima: delegate influencer ops. 20 angel conversations.", "35 new"),
        ("Week Sep 22–28", "Q3 close", "CTO: SOC2 evidence start. Garima: Q3 metrics report. MRR $4.5K target.", "30 new, 35 paying"),
    ]
    for week, theme, actions, target in weeks_q3:
        heading(doc, week, level=3)
        body(doc, f"Theme: {theme}")
        body(doc, f"Actions: {actions}")
        body(doc, f"Target: {target}", bold=True)

    page_break(doc)

    heading(doc, "Appendix I: Technology Stack Detail")
    add_styled_table(doc,
        ["Layer", "Technology", "Purpose", "Status"],
        [
            ["Frontend (web)", "Next.js 14, React, Tailwind", "Lawyer OS, consumer checker", "Production"],
            ["Frontend (mobile)", "Flutter (Dart)", "iOS + Android lawyer app", "Production"],
            ["Backend API", "NestJS (TypeScript)", "Modular monolith, multi-tenant", "Production"],
            ["Database", "PostgreSQL (Prisma ORM)", "Tenants, matters, billing, users", "Production"],
            ["Queue", "Redis (BullMQ)", "Async AI jobs, notifications", "Production"],
            ["Storage", "AWS S3", "Documents, uploads", "Production"],
            ["AI models", "OpenAI GPT-4o, model router", "Drafting, research, analysis", "Production"],
            ["Payments", "Stripe", "Subscriptions, credits, invoicing", "Production"],
            ["Auth", "Custom JWT + Google OAuth", "Multi-tenant auth", "Production"],
            ["Infra", "AWS (ECS/RDS)", "Hosting, CI/CD", "Production"],
            ["Monitoring", "CloudWatch + custom", "Errors, latency, AI costs", "Partial"],
            ["Compliance", "SOC2 controls (CC1-CC9)", "US enterprise trust", "In progress"],
        ], [1.2, 1.8, 1.5, 1.0])

    heading(doc, "Appendix J: Brand Voice & Messaging Guidelines")
    body(doc, "India (Hinglish): Professional but relatable — like a senior lawyer talking to a junior. Mix Hindi and English naturally.")
    body(doc, "US (English): Confident, practical, no hype. Lead with time saved and risk reduced. Avoid 'AI lawyer' or 'revolutionary.'")
    add_styled_table(doc,
        ["Context", "Do", "Don't"],
        [
            ["Product description", "Legal information & practice tools", "AI lawyer, guaranteed outcomes"],
            ["India CTA", "30-day free trial · Link in bio", "Free forever, no catch"],
            ["US CTA", "Start your 30-day free trial", "Disrupting the legal industry"],
            ["Social proof", "X lawyers trust Umbrella", "Best legal AI in the world"],
            ["Competitive", "More than Clio, more affordable than Harvey", "Clio is terrible"],
            ["Disclaimer", "Not a substitute for licensed counsel", "Skip disclaimers"],
        ], [1.2, 2.0, 2.0])

    heading(doc, "Appendix D: Glossary")
    add_styled_table(doc,
        ["Term", "Definition"],
        [
            ["Activated", "Lawyer who completed profile + 1 core action (draft, research, FIR, or leads)"],
            ["City-first entry", "Single city or practice-area focus before national or broad market spend"],
            ["CAC", "Customer Acquisition Cost — total marketing spend / new paying customers"],
            ["D7 retention", "% of activated lawyers who return within 7 days"],
            ["Flywheel", "Self-reinforcing growth loop: consumer → lead → lawyer → more consumers"],
            ["LTV", "Lifetime Value — ARPU × average customer lifetime in months"],
            ["MRR", "Monthly Recurring Revenue from subscriptions"],
            ["North Star", "D7 activated retention — predicts long-term revenue"],
            ["Wedge", "Single compelling feature that drives initial adoption (India legal notice drafting)"],
        ], [1.5, 3.0])

    # Footer
    doc.add_paragraph()
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = p.add_run(
        "Umbrella by Okay Legal · Confidential\n"
        "Document owner: Garima (CFO) + CTO (Engineering)\n"
        "Review cadence: Weekly (Monday growth meeting) · Full revision: Monthly\n"
        "Next review: August 1, 2026\n"
        "Contact: g.jain@okaylegal.ai"
    )
    r.font.size = Pt(9)
    r.font.color.rgb = SLATE
    r.italic = True

    doc.save(OUTPUT)
    print(f"Wrote {OUTPUT}")


if __name__ == "__main__":
    build_document()
