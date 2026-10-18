"""
Umbrella 3-Year Financial Model — Shared Assumptions
=====================================================
Year 1 data is LOCKED to the business plan (generate-business-plan-docx.py).
Year 2–3 data is directional, grounded in plan Sections 3.2, 18.1, 18.2.

Currency: USD consolidated. INR costs converted at FX_INRUSD.
Timeline: Jul 2026 → Jun 2029 (36 months, indices 0–35).
"""

from datetime import date, datetime
from calendar import month_abbr

# ── Timeline ──────────────────────────────────────────────────────────────

START = date(2026, 7, 1)
N_MONTHS = 36

def month_label(i: int) -> str:
    """Return 'Jul-26' style label for month index i (0-based)."""
    year = START.year + (START.month - 1 + i) // 12
    month = (START.month - 1 + i) % 12 + 1
    return f"{month_abbr[month]}-{str(year)[2:]}"

MONTH_LABELS = [month_label(i) for i in range(N_MONTHS)]

# ── FX & Global Inputs ────────────────────────────────────────────────────

FX_INRUSD = 85.0          # ₹ per $1  (editable on Assumptions tab)
INR_LAKH = 100_000        # 1L = ₹1,00,000

def inr_to_usd(inr: float) -> float:
    return inr / FX_INRUSD

# ── Pricing ───────────────────────────────────────────────────────────────

INDIA_ARPU_INR = 2_000     # blended per seat/mo (80% Starter ₹1400, 15% Pro ₹6000, 5% ProPlus ₹30000)
INDIA_ARPU_USD = inr_to_usd(INDIA_ARPU_INR)   # ≈ $23.5

US_ARPU_USD = 85.0         # blended per seat/mo (70% Starter $50, 20% Pro $200, 10% ProPlus $1000)

SEATS_PER_FIRM = 2.5       # average seats per paying firm

INDIA_ARPU_FIRM_USD = INDIA_ARPU_USD * SEATS_PER_FIRM   # ≈ $58.8/firm/mo
US_ARPU_FIRM_USD = US_ARPU_USD * SEATS_PER_FIRM         # = $212.5/firm/mo

CONSUMER_PLUS_INR = 1_000  # ₹1,000/mo
CONSUMER_PLUS_USD = inr_to_usd(CONSUMER_PLUS_INR)

# ── Funnel Assumptions ────────────────────────────────────────────────────

TRIAL_TO_PAID_EARLY = 0.12   # months 1–3
TRIAL_TO_PAID_MATURE = 0.22  # month 6+
LOGO_CHURN_MONTHLY = 0.08    # 8%/mo max (plan target)
NRR = 1.05                   # net revenue retention (upsells + expansion)

# ── COGS Rates ────────────────────────────────────────────────────────────

AI_COST_PCT_Y1 = 0.40        # AI inference as % of revenue, Year 1
AI_COST_PCT_Y2 = 0.38        # improving via model router
AI_COST_PCT_Y3 = 0.35        # Year 3 target
INFRA_PCT = 0.03             # cloud infra (AWS ECS/RDS) % of revenue
STRIPE_PCT = 0.029           # Stripe processing fee %
STRIPE_FIXED = 0.30          # Stripe fixed fee per transaction (USD)

# Per-month COGS rate: ramp AI cost linearly from Y1→Y3
def ai_cost_pct(month_idx: int) -> float:
    if month_idx < 12:
        return AI_COST_PCT_Y1
    elif month_idx < 24:
        t = (month_idx - 12) / 11
        return AI_COST_PCT_Y1 + t * (AI_COST_PCT_Y2 - AI_COST_PCT_Y1)
    else:
        t = (month_idx - 24) / 11
        return AI_COST_PCT_Y2 + t * (AI_COST_PCT_Y3 - AI_COST_PCT_Y2)

# ── Year 1: Appendix E (LOCKED to business plan) ─────────────────────────
# Source: generate-business-plan-docx.py lines 1145–1158
# Cols: month_idx, india_paying, us_paying, india_mrr_usd, us_mrr_usd, total_mrr_usd

Y1_MONTHLY_REVENUE = [
    # idx  india_pay  us_pay  india_mrr   us_mrr    total_mrr
    (  0,      4,       1,      400,        200,       600),
    (  1,     14,       4,    1_400,        600,     2_000),
    (  2,     27,       8,    2_800,      1_700,     4_500),
    (  3,     42,      13,    4_500,      3_500,     8_000),
    (  4,     60,      20,    6_500,      5_500,    12_000),
    (  5,     80,      30,    9_000,      8_000,    17_000),
    (  6,     95,      40,   11_000,     11_000,    22_000),
    (  7,    110,      50,   13_500,     14_500,    28_000),
    (  8,    120,      55,   16_000,     18_000,    34_000),
    (  9,    128,      57,   18_500,     21_500,    40_000),
    ( 10,    135,      60,   21_000,     24_000,    45_000),
    ( 11,    140,      60,   27_000,     21_000,    50_000),
]

# Year 1 quarterly P&L (Section 11.2) — used for validation
Y1_QUARTERLY_PL = {
    "Q3_2026": {"revenue": 8_000,  "cogs": 3_500,  "marketing": 4_400,  "salaries": 0,      "tools": 1_000},
    "Q4_2026": {"revenue": 42_000, "cogs": 18_000, "marketing": 14_000, "salaries": 8_000,  "tools": 3_000},
    "H1_2027": {"revenue": 210_000,"cogs": 85_000, "marketing": 34_000, "salaries": 60_000, "tools": 8_000},
}
Y1_TOTAL_PL = {"revenue": 260_000, "cogs": 106_000, "marketing": 52_000, "salaries": 68_000, "tools": 12_000}

# ── Year 1: Marketing Budget (Section 10.1) ───────────────────────────────
# Annual totals in USD

Y1_MARKETING_USD = {
    "India influencers":    25_000,   # ₹21.5L
    "US marketing":         12_500,   # ₹10.6L
    "Events & conferences":  5_882,   # ₹5L
    "Analytics & CRM tools": 2_471,   # ₹2.1L
    "Content production":    2_941,   # ₹2.5L
    "Contingency (10%)":     4_706,   # ₹4L
}
Y1_MARKETING_TOTAL_USD = sum(Y1_MARKETING_USD.values())  # ≈ $53K (plan says ~$53K ✓)

# Monthly distribution weights (Q3 light, Q4 medium, H1 heavy)
Y1_MARKETING_MONTHLY_WEIGHTS = [
    # Jul Aug Sep  Oct  Nov  Dec  Jan  Feb  Mar  Apr  May  Jun
    0.03, 0.05, 0.06, 0.09, 0.09, 0.09, 0.10, 0.10, 0.11, 0.10, 0.09, 0.09
]

# Marketing guardrail: spend ≤ 30% of MRR until MRR > $25K
MARKETING_GUARDRAIL_PCT = 0.30
MARKETING_GUARDRAIL_MRR_THRESHOLD = 25_000

# ── Incremental Salary Tiers (MRR-gated) ──────────────────────────────────
# Base salary in INR/month before employer burden. Steps up as MRR grows.
# Roles: Co-CEO/CTO, Co-CEO/CFO/CMO (Garima), India Marketing Manager

INCREMENTAL_SALARY_ROLES = {
    "Co-CEO / CTO": {
        "start_idx": 3,   # post-angel (Oct 2026); zero through Q3 per plan
        "location": "India",
        "contractor": False,
        "dept": "Engineering",
        "tiers_inr": [
            (0,       0),
            (5_000,   60_000),    # angel close, $5K MRR
            (17_000,  80_000),    # $17K MRR (Dec 2026)
            (25_000,  100_000),   # seed gate
            (50_000,  120_000),   # Y1 exit
            (100_000, 150_000),   # Y2 ramp
            (150_000, 180_000),   # Series A gate
            (200_000, 200_000),   # Y2 exit
            (350_000, 250_000),   # Y3 scale
            (500_000, 300_000),   # Y3 exit
        ],
    },
    "Co-CEO / CFO / CMO (Garima)": {
        "start_idx": 3,
        "location": "India",
        "contractor": False,
        "dept": "G&A",
        "tiers_inr": [
            (0,       0),
            (5_000,   60_000),
            (17_000,  80_000),
            (25_000,  100_000),
            (50_000,  120_000),
            (100_000, 150_000),
            (150_000, 180_000),
            (200_000, 200_000),
            (350_000, 250_000),
            (500_000, 300_000),
        ],
    },
    "India Marketing Manager": {
        "start_idx": 2,   # Sep 2026
        "location": "India",
        "contractor": False,
        "dept": "Marketing",
        "tiers_inr": [
            (0,       60_000),    # hire at ₹60K
            (17_000,  70_000),
            (25_000,  80_000),
            (50_000,  90_000),
            (100_000, 100_000),
            (150_000, 120_000),
            (200_000, 140_000),
            (350_000, 160_000),
            (500_000, 180_000),
        ],
    },
}


def incremental_base_inr(role: str, mrr: float) -> float:
    """Return INR/month base salary for an incremental role at given MRR."""
    cfg = INCREMENTAL_SALARY_ROLES.get(role)
    if not cfg:
        return 0.0
    base = cfg["tiers_inr"][0][1]
    for threshold, salary_inr in cfg["tiers_inr"]:
        if mrr >= threshold:
            base = salary_inr
    return base


# ── Dividends (shareholder distributions) ─────────────────────────────────
# Paid once per fiscal year (Jun) to all shareholders.
# Pool = 20% of that year's gross profit. Not counted in OpEx.

SHAREHOLDERS = [
    ("Co-CEO / CTO",                0.50),
    ("Co-CEO / CFO / CMO (Garima)", 0.50),
]

DIVIDEND_ANNUAL_PCT_OF_GROSS_PROFIT = 0.20   # 20% of annual gross profit
# Fiscal year ends Jun: Y1 idx 11, Y2 idx 23, Y3 idx 35
DIVIDEND_ANNUAL_PAYMENT_MONTHS = [11, 23, 35]

# ── Headcount: Year 1 (Section 13.1, LOCKED) ─────────────────────────────
# Format: (role, dept, location, start_month_idx, end_month_idx, base_usd_mo, is_contractor)
# Founders + India Marketing Manager use INCREMENTAL_SALARY_ROLES (base_usd ignored).

Y1_HIRES = [
    ("Co-CEO / CTO",                "Engineering",  "India", 0,  35, 0,       False),
    ("Co-CEO / CFO / CMO (Garima)", "G&A",          "India", 0,  35, 0,       False),
    ("India Marketing Manager",     "Marketing",    "India", 2,  35, 0,       False),   # Sep 2026 = idx 2
    ("Customer Success (PT)",       "CS",           "India", 4,  35, inr_to_usd(40_000),  False),   # Nov 2026 = idx 4
    ("US BD (contract)",            "Sales",        "US",    6,  35, 3_000,   True),                # Jan 2027 = idx 6
    ("Backend Engineer",            "Engineering",  "India", 8,  35, inr_to_usd(120_000), False),   # Mar 2027 = idx 8
    ("Content / Influencer Coord",  "Marketing",    "India", 8,  35, inr_to_usd(50_000),  False),   # Mar 2027 = idx 8
]

# ── Headcount: Year 2 additions (Jul 2027 = idx 12) ──────────────────────

Y2_HIRES = [
    ("Senior Engineer #1",          "Engineering",  "India", 12, 35, inr_to_usd(150_000), False),
    ("Senior Engineer #2",          "Engineering",  "India", 14, 35, inr_to_usd(150_000), False),
    ("UK/CA BD (contract)",         "Sales",        "US",    12, 35, 4_000,   True),
    ("Customer Success - India",    "CS",           "India", 15, 35, inr_to_usd(50_000),  False),
    ("Customer Success - US",       "CS",           "US",    15, 35, 4_000,   False),
    ("US Account Executive #1",     "Sales",        "US",    15, 35, 8_000,   False),
    ("US Account Executive #2",     "Sales",        "US",    16, 35, 8_000,   False),
    ("Finance / Ops Manager",       "G&A",          "India", 18, 35, inr_to_usd(100_000), False),
    ("SDR",                         "Sales",        "US",    18, 35, 5_000,   False),
    ("India Enterprise Sales",      "Sales",        "India", 21, 35, inr_to_usd(80_000),  False),
]

# ── Headcount: Year 3 additions (Jul 2028 = idx 24) ──────────────────────

Y3_HIRES = [
    ("Senior Engineer #3",          "Engineering",  "India", 24, 35, inr_to_usd(150_000), False),
    ("AI/ML Engineer",              "Engineering",  "India", 24, 35, inr_to_usd(180_000), False),
    ("Compliance Engineer",         "Engineering",  "India", 25, 35, inr_to_usd(130_000), False),
    ("Mobile Engineer",             "Engineering",  "India", 25, 35, inr_to_usd(120_000), False),
    ("Senior Engineer #4",          "Engineering",  "India", 26, 35, inr_to_usd(150_000), False),
    ("Platform Engineer",           "Engineering",  "US",    27, 35, 12_000,  False),
    ("Security / Infra Engineer",   "Engineering",  "India", 27, 35, inr_to_usd(130_000), False),
    ("Senior Engineer #5",          "Engineering",  "India", 28, 35, inr_to_usd(150_000), False),
    ("US AE #3",                    "Sales",        "US",    24, 35, 8_000,   False),
    ("US AE #4",                    "Sales",        "US",    26, 35, 8_000,   False),
    ("SDR #2",                      "Sales",        "US",    24, 35, 5_000,   False),
    ("SDR #3",                      "Sales",        "US",    27, 35, 5_000,   False),
    ("EU GTM (contract)",           "Sales",        "US",    24, 35, 6_000,   True),
    ("LATAM GTM (contract)",        "Sales",        "US",    26, 35, 5_000,   True),
    ("APAC GTM (contract)",         "Sales",        "US",    28, 35, 5_000,   True),
    ("CS Manager",                  "CS",           "US",    24, 35, 6_000,   False),
    ("CS - India #2",               "CS",           "India", 24, 35, inr_to_usd(50_000),  False),
    ("CS - India #3",               "CS",           "India", 26, 35, inr_to_usd(50_000),  False),
    ("CS - US #2",                  "CS",           "US",    27, 35, 4_000,   False),
    ("CS - US #3",                  "CS",           "US",    29, 35, 4_000,   False),
    ("Legal / Compliance",          "G&A",          "India", 24, 35, inr_to_usd(100_000), False),
    ("HR Manager",                  "G&A",          "India", 25, 35, inr_to_usd(80_000),  False),
    ("Controller / Finance",        "G&A",          "US",    26, 35, 8_000,   False),
    ("Executive Assistant / Admin", "G&A",          "India", 28, 35, inr_to_usd(40_000),  False),
    ("Brand / Content Manager",     "Marketing",    "India", 24, 35, inr_to_usd(80_000),  False),
    ("Performance Marketer",        "Marketing",    "US",    25, 35, 7_000,   False),
    ("Partnerships Manager",        "Marketing",    "India", 27, 35, inr_to_usd(80_000),  False),
]

ALL_HIRES = Y1_HIRES + Y2_HIRES + Y3_HIRES

# Employer burden by location
BURDEN_INDIA = 0.15   # PF, gratuity, medical
BURDEN_US = 0.25      # FICA, health, 401k

def loaded_cost_usd(base_usd: float, location: str, is_contractor: bool) -> float:
    if is_contractor:
        return base_usd
    burden = BURDEN_US if location == "US" else BURDEN_INDIA
    return base_usd * (1 + burden)

# ── Revenue: Year 2–3 Anchor Points ──────────────────────────────────────
# Exit MRR targets (month index of last month of year)
# Jun 2027 = idx 11, Jun 2028 = idx 23, Jun 2029 = idx 35

Y1_EXIT_MRR_BASE = 50_000       # Jun 2027 — original business plan
Y2_EXIT_MRR_BASE = 200_000      # Jun 2028
Y3_EXIT_MRR_BASE = 500_000      # Jun 2029 → $6M ARR

# Scale scenario — $50M ARR by Year 3 (Jun 2029)
Y1_EXIT_MRR_SCALE = 175_000     # Jun 2027 — aggressive PMF + flywheel
Y2_EXIT_MRR_SCALE = 1_250_000   # Jun 2028 → $15M ARR
Y3_EXIT_MRR_SCALE = 4_166_667   # Jun 2029 → $50M ARR ($4.167M MRR)

SCENARIOS = {
    "Base": {
        "label": "Base Plan (Original)",
        "y1_exit_mrr": Y1_EXIT_MRR_BASE,
        "y2_exit_mrr": Y2_EXIT_MRR_BASE,
        "y3_exit_mrr": Y3_EXIT_MRR_BASE,
        "y3_arr": Y3_EXIT_MRR_BASE * 12,
        "y3_paying_firms": 2_000,
        "y3_team": "40–50",
        "seed": 2_000_000,
        "series_a": 10_000_000,
        "series_b": 0,
    },
    "Scale": {
        "label": "Scale Plan ($50M ARR)",
        "y1_exit_mrr": Y1_EXIT_MRR_SCALE,
        "y2_exit_mrr": Y2_EXIT_MRR_SCALE,
        "y3_exit_mrr": Y3_EXIT_MRR_SCALE,
        "y3_arr": 50_000_000,
        "y3_paying_firms": 15_000,
        "y3_team": "150–200",
        "seed": 4_000_000,
        "series_a": 25_000_000,
        "series_b": 50_000_000,
    },
}

# Legacy aliases (Base plan)
Y2_EXIT_MRR = Y2_EXIT_MRR_BASE
Y3_EXIT_MRR = Y3_EXIT_MRR_BASE

# Market mix targets at year-end (% of total MRR)
# Y1: India 55%, US 45%  (Appendix E Jun 2027: $27K India, $21K US → India 54%, US 42%, other 4%)
MIX_Y1 = {"india": 0.54, "us": 0.42, "uk_ca_au": 0.00, "consumer": 0.04}
# Y2: US 55%, India 30%, UK/CA/AU 15% (Section 18.1)
MIX_Y2 = {"india": 0.30, "us": 0.55, "uk_ca_au": 0.10, "consumer": 0.05}
# Y3: US-heavy, per Section 3.3 regional targets
MIX_Y3 = {"india": 0.20, "us": 0.55, "uk_ca_au": 0.10, "consumer": 0.05, "eu": 0.05, "latam_apac_mena": 0.05}

# ── OpEx: Non-Salary Cost Assumptions ────────────────────────────────────

OPEX = {
    # (annual_y1_usd, annual_y2_usd, annual_y3_usd)
    "office_facilities": (6_000,     42_000,  180_000),
    "tools_saas":       (12_000,     60_000,  150_000),
    "legal_compliance": (15_000,     80_000,  120_000),
    "localization":     (0,         120_000,  350_000),
    "travel_events":    (30_000,    100_000,  200_000),
    "ga_misc":          (10_000,     50_000,  100_000),
}

# ── Fundraising ───────────────────────────────────────────────────────────
# (name, month_idx, amount_usd)
FUNDRAISING = [
    ("Angels",   3,  200_000),   # Oct 2026 = idx 3
    ("Seed",     8,  2_000_000), # Mar 2027 = idx 8
    ("Series A", 18, 10_000_000),# Jan 2028 = idx 18
]

# Seed use-of-funds (Section 12.2)
SEED_USE_OF_FUNDS = {
    "Engineering (incl. AI)":     (0.40, 800_000),
    "US GTM":                     (0.25, 500_000),
    "India GTM":                  (0.15, 300_000),
    "Operations & CS":            (0.10, 200_000),
    "G&A / legal / compliance":   (0.05, 100_000),
    "Reserve":                    (0.05, 100_000),
}

# Series A use-of-funds (proposed)
SERIES_A_USE_OF_FUNDS = {
    "Engineering + AI localization":        (0.35, 3_500_000),
    "US sales team + GTM":                  (0.25, 2_500_000),
    "International expansion (UK/EU/APAC)": (0.20, 2_000_000),
    "CS + operations":                      (0.10, 1_000_000),
    "G&A / legal / compliance":             (0.05,   500_000),
    "Reserve":                              (0.05,   500_000),
}

# ── Unit Economics ────────────────────────────────────────────────────────

CAC_INDIA_TARGET_USD = 11    # ₹900 / 85
CAC_US_TARGET_USD = 120
PAYBACK_INDIA_MO = 1.5
PAYBACK_US_MO = 2.5

# ── Reconciliation Note (plan inconsistency) ──────────────────────────────
RECONCILIATION_NOTE = (
    "Section 3.2 lists per-market Y2 targets ($200K US + $80K India + $40K UK/CA/AU = $320K total) "
    "which exceeds the $200K exit MRR in Section 18.1. This model uses Section 18.1 as authoritative "
    "($200K total, split 55% US / 30% India / 15% UK-CA-AU). Section 3.2 figures appear to represent "
    "aspirational per-region ambitions rather than total consolidated MRR."
)
