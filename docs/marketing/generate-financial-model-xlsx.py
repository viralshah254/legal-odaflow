#!/usr/bin/env python3
"""
Umbrella 3-Year Financial Model — Formula-Driven Excel Generator
================================================================
All calculated cells use Excel formulas referencing the Assumptions tab.
Toggle scenario on Assumptions!B5: "Base" (original plan) or "Scale" ($50M ARR).

Run: python3 generate-financial-model-xlsx.py
"""

from pathlib import Path
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter
from openpyxl.workbook.defined_name import DefinedName

import sys
sys.path.insert(0, str(Path(__file__).parent))
from financial_assumptions import *

DIR = Path(__file__).parent
OUTPUT = DIR / "UMBRELLA-3-YEAR-FINANCIAL-MODEL.xlsx"

# ── Styles ────────────────────────────────────────────────────────────────
NAVY_HEX, TEAL_HEX, SLATE_HEX, WHITE_HEX, BLUE_HEX = "0F172A", "0D9488", "475569", "FFFFFF", "1D4ED8"
HEADER_FILL = PatternFill("solid", fgColor=NAVY_HEX)
TEAL_FILL = PatternFill("solid", fgColor=TEAL_HEX)
INPUT_FILL = PatternFill("solid", fgColor="EFF6FF")
GREEN_FILL = PatternFill("solid", fgColor="DCFCE7")
RED_FILL = PatternFill("solid", fgColor="FEE2E2")
thin = Side(style="thin", color="D1D5DB")
BORDER = Border(left=thin, right=thin, top=thin, bottom=thin)
FMT_USD, FMT_PCT, FMT_INT, FMT_MO = '"$"#,##0', "0.0%", "#,##0", "0.0"

FIRST_MCOL = 4          # column D = month 0
N_MCOLS = N_MONTHS
MCOL_LAST = FIRST_MCOL + N_MCOLS - 1

# Assumptions sheet row map (column B unless noted)
A = {
    "scenario": 5,
    "y1_base": 10, "y2_base": 11, "y3_base": 12,
    "y1_scale": 15, "y2_scale": 16, "y3_scale": 17,
    "y1_active": 19, "y2_active": 20, "y3_active": 21,
    "y1_table": 30,
    "fx": 40, "india_arpu": 41, "us_arpu": 42,
    "stripe_pct": 43, "infra_pct": 44,
    "ai_y1": 45, "ai_y2": 46, "ai_y3": 47,
    "mkt_y1": 48, "mkt_y2": 49, "mkt_y3": 50,
    "div_pct": 51,
    "mix_india_y1": 55, "mix_india_y2": 56, "mix_india_y3": 57,
    "mix_us_y1": 58, "mix_us_y2": 59, "mix_us_y3": 60,
    "starting_cash": 65,
    "angel": 66, "angel_mo": 67,
    "seed": 68, "seed_mo": 69,
    "series_a": 70, "series_a_mo": 71,
    "series_b": 72, "series_b_mo": 73,
    "seed_scale": 74, "series_a_scale": 75,
    "y3_firms_base": 76, "y3_firms_scale": 77,
    "seats": 79,
}


def ref(row, col="B"):
    return f"Assumptions!${col}${row}"


def xref(row, col="B"):
    """Cell reference as an Excel formula (=Assumptions!$B$n)."""
    return f"={ref(row, col)}"


def mcol(i):
    return get_column_letter(FIRST_MCOL + i)


def mrange(row):
    return f"{mcol(0)}{row}:{mcol(N_MCOLS - 1)}{row}"


def hdr_font(size=11):
    return Font(name="Calibri", size=size, bold=True, color=WHITE_HEX)


def body_font(bold=False):
    return Font(name="Calibri", size=10, bold=bold, color=SLATE_HEX)


def input_cell(ws, r, c, val, fmt=None):
    cell = ws.cell(r, c, val)
    cell.font = Font(name="Calibri", size=10, color=BLUE_HEX)
    cell.fill = INPUT_FILL
    cell.border = BORDER
    cell.alignment = Alignment(horizontal="right")
    if fmt:
        cell.number_format = fmt
    return cell


def formula_cell(ws, r, c, formula, fmt=FMT_USD, bold=False):
    cell = ws.cell(r, c)
    cell.value = formula
    cell.font = Font(name="Calibri", size=10, bold=bold, color=SLATE_HEX if not bold else NAVY_HEX)
    cell.border = BORDER
    cell.number_format = fmt
    cell.alignment = Alignment(horizontal="right")
    return cell


def label(ws, r, c, text, bold=False):
    cell = ws.cell(r, c, text)
    cell.font = Font(name="Calibri", size=10, bold=bold, color=NAVY_HEX)
    cell.border = BORDER
    cell.alignment = Alignment(horizontal="left", wrap_text=True)
    return cell


def section(ws, r, text, cols=6):
    ws.merge_cells(start_row=r, start_column=1, end_row=r, end_column=cols)
    c = ws.cell(r, 1, text)
    c.fill = TEAL_FILL
    c.font = hdr_font(10)
    return r


def setup_month_headers(ws, hdr_row=2, idx_row=3):
    label(ws, hdr_row, 1, "Line Item", bold=True)
    label(ws, hdr_row, 2, "36-Mo Total", bold=True)
    label(ws, hdr_row, 3, "Notes")
    for i in range(N_MCOLS):
        col = FIRST_MCOL + i
        c = ws.cell(hdr_row, col, MONTH_LABELS[i])
        c.fill = HEADER_FILL
        c.font = hdr_font(9)
        c.border = BORDER
        c.alignment = Alignment(horizontal="center")
        ws.cell(idx_row, col, i).number_format = FMT_INT
        ws.cell(idx_row, col, i).border = BORDER
    ws.freeze_panes = ws.cell(row=idx_row + 1, column=FIRST_MCOL)
    ws.column_dimensions["A"].width = 34
    ws.column_dimensions["B"].width = 14
    for i in range(N_MCOLS):
        ws.column_dimensions[mcol(i)].width = 9


def sum_formula(row):
    return f"=SUM({mcol(0)}{row}:{mcol(N_MCOLS - 1)}{row})"


def build_assumptions(wb):
    ws = wb.active
    ws.title = "Assumptions"
    ws.sheet_properties.tabColor = "1D4ED8"

    label(ws, 1, 1, "UMBRELLA — MODEL ASSUMPTIONS", bold=True)
    ws.merge_cells("A1:F1")
    label(ws, 2, 1, "Blue cells = inputs. Change B5 to 'Base' or 'Scale'. All other sheets recalculate via formulas.")

    r = section(ws, 4, "📊  Active Scenario")
    label(ws, 5, 1, "Active scenario (Base or Scale)")
    input_cell(ws, 5, 2, "Base", fmt="@")
    label(ws, 5, 3, "Base = original MRR plan · Scale = $50M ARR path")

    r = section(ws, 7, "📈  Exit MRR Anchors — Base Plan (Original)")
    for i, (lbl, val) in enumerate([
        ("Y1 exit MRR (Jun 2027)", Y1_EXIT_MRR_BASE),
        ("Y2 exit MRR (Jun 2028)", Y2_EXIT_MRR_BASE),
        ("Y3 exit MRR (Jun 2029)", Y3_EXIT_MRR_BASE),
    ]):
        row = A["y1_base"] + i
        label(ws, row, 1, lbl)
        input_cell(ws, row, 2, val, FMT_USD)
        formula_cell(ws, row, 3, f"={ref(row)}*12", FMT_USD)
        label(ws, row, 4, "ARR run-rate")

    r = section(ws, 14, "🚀  Exit MRR Anchors — Scale Plan ($50M ARR)")
    for i, (lbl, val) in enumerate([
        ("Y1 exit MRR (Jun 2027)", Y1_EXIT_MRR_SCALE),
        ("Y2 exit MRR (Jun 2028)", Y2_EXIT_MRR_SCALE),
        ("Y3 exit MRR (Jun 2029)", Y3_EXIT_MRR_SCALE),
    ]):
        row = A["y1_scale"] + i
        label(ws, row, 1, lbl)
        input_cell(ws, row, 2, val, FMT_USD)
        if i == 2:
            formula_cell(ws, row, 3, f"={ref(row)}*12", FMT_USD)
            label(ws, row, 4, "Target $50M ARR (= MRR × 12)")
        else:
            formula_cell(ws, row, 3, f"={ref(row)}*12", FMT_USD)

    r = section(ws, 18, "✅  Active Exit MRR (formula — driven by scenario)")
    for i, lbl in enumerate(["Active Y1 exit MRR", "Active Y2 exit MRR", "Active Y3 exit MRR"]):
        row = A["y1_active"] + i
        base_r = A["y1_base"] + i
        scale_r = A["y1_scale"] + i
        label(ws, row, 1, lbl)
        formula_cell(ws, row, 2,
                     f'=IF({ref(A["scenario"])}="Scale",{ref(scale_r)},{ref(base_r)})', bold=True)
        formula_cell(ws, row, 3, f"={ref(row)}*12", FMT_USD)

    r = section(ws, 23, "📅  Year 1 Base MRR Build (Appendix E — locked)")
    label(ws, 29, 1, "Month")
    for i, lbl in enumerate(MONTH_LABELS[:12]):
        ws.cell(29, 3 + i, lbl).font = body_font(bold=True)
    label(ws, 30, 1, "Base plan total MRR")
    for i, row_data in enumerate(Y1_MONTHLY_REVENUE):
        _, _, _, _, _, tm = row_data
        input_cell(ws, 30, 3 + i, tm, FMT_USD)
    label(ws, 31, 1, "Scale Y1 formula note")
    ws.merge_cells("B31:F31")
    ws.cell(31, 2, "Scale Y1 months = Base × (1 + (ScaleExit/BaseExit − 1) × month/11)").font = body_font()

    r = section(ws, 33, "💱  Pricing & COGS")
    inputs = [
        ("INR / USD FX", A["fx"], FX_INRUSD, FMT_USD),
        ("India ARPU (USD/seat/mo)", A["india_arpu"], INDIA_ARPU_USD, FMT_USD),
        ("US ARPU (USD/seat/mo)", A["us_arpu"], US_ARPU_USD, FMT_USD),
        ("Avg seats per paying firm", A["seats"], SEATS_PER_FIRM, "0.0"),
        ("Stripe fee %", A["stripe_pct"], STRIPE_PCT, FMT_PCT),
        ("Cloud infra % of revenue", A["infra_pct"], INFRA_PCT, FMT_PCT),
        ("AI cost % rev — Year 1", A["ai_y1"], AI_COST_PCT_Y1, FMT_PCT),
        ("AI cost % rev — Year 2", A["ai_y2"], AI_COST_PCT_Y2, FMT_PCT),
        ("AI cost % rev — Year 3", A["ai_y3"], AI_COST_PCT_Y3, FMT_PCT),
        ("Marketing % rev — Y1", A["mkt_y1"], 0.20, FMT_PCT),
        ("Marketing % rev — Y2", A["mkt_y2"], 0.25, FMT_PCT),
        ("Marketing % rev — Y3", A["mkt_y3"], 0.22, FMT_PCT),
        ("Dividend % of annual gross profit", A["div_pct"], DIVIDEND_ANNUAL_PCT_OF_GROSS_PROFIT, FMT_PCT),
    ]
    for lbl, row, val, fmt in inputs:
        label(ws, row, 1, lbl)
        input_cell(ws, row, 2, val, fmt)

    r = section(ws, 53, "🌍  Revenue Mix (% of total MRR at year-end)")
    mix = [
        ("India mix Y1", A["mix_india_y1"], MIX_Y1["india"]),
        ("India mix Y2", A["mix_india_y2"], MIX_Y2["india"]),
        ("India mix Y3", A["mix_india_y3"], MIX_Y3["india"]),
        ("US mix Y1", A["mix_us_y1"], MIX_Y1["us"]),
        ("US mix Y2", A["mix_us_y2"], MIX_Y2["us"]),
        ("US mix Y3", A["mix_us_y3"], MIX_Y3["us"]),
    ]
    for lbl, row, val in mix:
        label(ws, row, 1, lbl)
        input_cell(ws, row, 2, val, FMT_PCT)

    r = section(ws, 62, "💰  Fundraising (active scenario uses Scale amounts when Scale selected)")
    label(ws, A["starting_cash"], 1, "Starting cash (Jul 2026)")
    input_cell(ws, A["starting_cash"], 2, 20_000, FMT_USD)
    fundraise = [
        ("Angels amount", A["angel"], 200_000, A["angel_mo"], 3),
        ("Seed amount", A["seed"], 2_000_000, A["seed_mo"], 8),
        ("Series A amount", A["series_a"], 10_000_000, A["series_a_mo"], 18),
        ("Series B amount (Scale)", A["series_b"], 50_000_000, A["series_b_mo"], 30),
    ]
    for lbl, amt_row, base_amt, mo_row, mo_idx in fundraise:
        label(ws, amt_row, 1, lbl)
        input_cell(ws, amt_row, 2, base_amt, FMT_USD)
        label(ws, mo_row, 1, f"{lbl} — month index (0=Jul-26)")
        input_cell(ws, mo_row, 2, mo_idx, FMT_INT)

    label(ws, A["seed_scale"], 1, "Seed amount (Scale scenario)")
    input_cell(ws, A["seed_scale"], 2, SCENARIOS["Scale"]["seed"], FMT_USD)
    label(ws, A["series_a_scale"], 1, "Series A amount (Scale scenario)")
    input_cell(ws, A["series_a_scale"], 2, SCENARIOS["Scale"]["series_a"], FMT_USD)
    label(ws, A["y3_firms_base"], 1, "Y3 paying firms target (Base)")
    input_cell(ws, A["y3_firms_base"], 2, SCENARIOS["Base"]["y3_paying_firms"], FMT_INT)
    label(ws, A["y3_firms_scale"], 1, "Y3 paying firms target (Scale)")
    input_cell(ws, A["y3_firms_scale"], 2, SCENARIOS["Scale"]["y3_paying_firms"], FMT_INT)

    r = section(ws, 79, "👥  Incremental salary & dividend notes")
    label(ws, 80, 1, "See Headcount Plan tab. Dividends = 20% annual GP, paid each June.")
    ws.column_dimensions["A"].width = 42
    ws.column_dimensions["B"].width = 16


def mrr_formula(col_letter):
    """Total MRR formula for a month column referencing Assumptions + month index row 3."""
    m = f"{col_letter}$3"
    y1_tbl = f"{ref(A['y1_table'],'C')}:{get_column_letter(3+11)}{A['y1_table']}"
    return (
        f"=IF({m}<=11,"
        f'IF({ref(A["scenario"])}="Scale",'
        f"INDEX({y1_tbl},1,{m}+1)*(1+({ref(A['y1_scale'])}/{ref(A['y1_base'])}-1)*({m}/11)),"
        f"INDEX({y1_tbl},1,{m}+1)),"
        f"IF({m}<=23,"
        f"{ref(A['y1_active'])}*({ref(A['y2_active'])}/{ref(A['y1_active'])})^(({m}-11)/12),"
        f"{ref(A['y2_active'])}*({ref(A['y3_active'])}/{ref(A['y2_active'])})^(({m}-23)/12)))"
    )


def mix_india_formula(col_letter):
    m = f"{col_letter}$3"
    return (
        f"=IF({m}<=11,{ref(A['mix_india_y1'])},"
        f"IF({m}<=23,{ref(A['mix_india_y1'])}+({ref(A['mix_india_y2'])}-{ref(A['mix_india_y1'])})*({m}-11)/12,"
        f"{ref(A['mix_india_y2'])}+({ref(A['mix_india_y3'])}-{ref(A['mix_india_y2'])})*({m}-23)/12)))"
    )


def mix_us_formula(col_letter):
    m = f"{col_letter}$3"
    return (
        f"=IF({m}<=11,{ref(A['mix_us_y1'])},"
        f"IF({m}<=23,{ref(A['mix_us_y1'])}+({ref(A['mix_us_y2'])}-{ref(A['mix_us_y1'])})*({m}-11)/12,"
        f"{ref(A['mix_us_y2'])}+({ref(A['mix_us_y3'])}-{ref(A['mix_us_y2'])})*({m}-23)/12)))"
    )


def ai_pct_formula(col_letter):
    m = f"{col_letter}$3"
    return (
        f"=IF({m}<12,{ref(A['ai_y1'])},"
        f"IF({m}<24,{ref(A['ai_y1'])}+({ref(A['ai_y2'])}-{ref(A['ai_y1'])})*({m}-12)/11,"
        f"{ref(A['ai_y2'])}+({ref(A['ai_y3'])}-{ref(A['ai_y2'])})*({m}-24)/11)))"
    )


def mkt_pct_formula(col_letter):
    m = f"{col_letter}$3"
    return (
        f"=IF({m}<12,{ref(A['mkt_y1'])},"
        f"IF({m}<24,{ref(A['mkt_y2'])},{ref(A['mkt_y3'])}))"
    )


def mrr_tier_salary_formula(col_letter, role, location):
    """Nested IF on Revenue Build MRR → INR tier → USD loaded salary."""
    tiers = INCREMENTAL_SALARY_ROLES[role]["tiers_inr"]
    mrr_ref = f"'Revenue Build'!{col_letter}5"
    fx = ref(A["fx"])
    burden = 1.25 if location == "US" else 1.15
    expr = "0"
    for mrr_threshold, inr_salary in reversed(tiers):
        sal = f"({inr_salary}/{fx})" if inr_salary else "0"
        sal = f"({sal}*{burden})"
        expr = f"IF({mrr_ref}>={mrr_threshold},{sal},{expr})"
    return f"={expr}"


def cell_formula(val):
    """Normalize a value into an Excel formula string."""
    s = str(val)
    if s.startswith("="):
        return s
    if s.startswith("Assumptions!"):
        return f"={s}"
    return None


def build_scenarios(wb):
    ws = wb.create_sheet("Scenarios")
    ws.sheet_properties.tabColor = "065F46"
    label(ws, 1, 1, "BASE vs SCALE — Side-by-Side Comparison", bold=True)
    ws.merge_cells("A1:E1")

    headers = ["Metric", "Base Plan", "Scale Plan ($50M ARR)", "Multiple", "Notes"]
    for c, h in enumerate(headers, 1):
        cell = ws.cell(2, c, h)
        cell.fill = HEADER_FILL
        cell.font = hdr_font(10)
        cell.border = BORDER

    rows = [
        ("Y1 exit MRR (Jun 2027)", xref(A["y1_base"]), xref(A["y1_scale"]),
         f"={ref(A['y1_scale'])}/{ref(A['y1_base'])}", "PMF vs aggressive flywheel"),
        ("Y2 exit MRR (Jun 2028)", xref(A["y2_base"]), xref(A["y2_scale"]),
         f"={ref(A['y2_scale'])}/{ref(A['y2_base'])}", "US enterprise motion"),
        ("Y3 exit MRR (Jun 2029)", xref(A["y3_base"]), xref(A["y3_scale"]),
         f"={ref(A['y3_scale'])}/{ref(A['y3_base'])}", "Scale hits $50M ARR"),
        ("Y3 ARR run-rate", f"={ref(A['y3_base'])}*12", f"={ref(A['y3_scale'])}*12",
         f"=({ref(A['y3_scale'])}*12)/({ref(A['y3_base'])}*12)", "8.3× revenue ambition"),
        ("Seed round", xref(A["seed"]), xref(A["seed_scale"]),
         f"={ref(A['seed_scale'])}/{ref(A['seed'])}", "Scale needs $3–5M"),
        ("Series A", xref(A["series_a"]), xref(A["series_a_scale"]),
         f"={ref(A['series_a_scale'])}/{ref(A['series_a'])}", "Scale: ~$25M"),
        ("Series B", "=0", xref(A["series_b"]), "—", "Scale only — mid Y3"),
        ("Y3 paying firms (target)", xref(A["y3_firms_base"]), xref(A["y3_firms_scale"]),
         f"={ref(A['y3_firms_scale'])}/{ref(A['y3_firms_base'])}", "Volume + enterprise"),
        ("Y3 team (target)", "40–50", "150–200", "—", "Heavy US sales org"),
    ]
    for i, (metric, base, scale, mult, note) in enumerate(rows, 3):
        label(ws, i, 1, metric)
        base_f = cell_formula(base)
        if base_f:
            formula_cell(ws, i, 2, base_f)
        else:
            ws.cell(i, 2, base).border = BORDER
        scale_f = cell_formula(scale)
        if scale_f:
            formula_cell(ws, i, 3, scale_f)
        else:
            ws.cell(i, 3, scale).border = BORDER
        if mult.startswith("="):
            formula_cell(ws, i, 4, mult, fmt="0.0×" if "×" in mult else FMT_USD)
        else:
            ws.cell(i, 4, mult).border = BORDER
        label(ws, i, 5, note)

    label(ws, 14, 1, "Active scenario selection →")
    formula_cell(ws, 14, 2, f"={ref(A['scenario'])}", fmt="@")
    ws.column_dimensions["A"].width = 28
    ws.column_dimensions["E"].width = 36


def build_revenue(wb):
    ws = wb.create_sheet("Revenue Build")
    ws.sheet_properties.tabColor = "065F46"
    label(ws, 1, 1, "REVENUE BUILD — Formula-driven (references Assumptions)", bold=True)
    setup_month_headers(ws)

    R_MRR, R_MIX_I, R_INDIA, R_MIX_U, R_US, R_OTHER, R_ARR, R_PAY = 5, 6, 7, 8, 9, 10, 11, 12

    labels = [
        (R_MRR, "Total MRR", True),
        (R_MIX_I, "India mix %", False),
        (R_INDIA, "India firm MRR", False),
        (R_MIX_U, "US mix %", False),
        (R_US, "US firm MRR", False),
        (R_OTHER, "Other (UK/EU/consumer)", False),
        (R_ARR, "ARR run-rate", True),
        (R_PAY, "Paying firms (est.)", False),
    ]
    for row, text, bold in labels:
        label(ws, row, 1, text, bold=bold)
        formula_cell(ws, row, 2, sum_formula(row), bold=bold)

    for i in range(N_MCOLS):
        col = mcol(i)
        cl = col
        formula_cell(ws, R_MRR, FIRST_MCOL + i, mrr_formula(cl), bold=True)
        formula_cell(ws, R_MIX_I, FIRST_MCOL + i, mix_india_formula(cl), fmt=FMT_PCT)
        formula_cell(ws, R_INDIA, FIRST_MCOL + i, f"={cl}{R_MRR}*{cl}{R_MIX_I}")
        formula_cell(ws, R_MIX_U, FIRST_MCOL + i, mix_us_formula(cl), fmt=FMT_PCT)
        formula_cell(ws, R_US, FIRST_MCOL + i, f"={cl}{R_MRR}*{cl}{R_MIX_U}")
        formula_cell(ws, R_OTHER, FIRST_MCOL + i, f"={cl}{R_MRR}-{cl}{R_INDIA}-{cl}{R_US}")
        formula_cell(ws, R_ARR, FIRST_MCOL + i, f"={cl}{R_MRR}*12", bold=True)
        formula_cell(ws, R_PAY, FIRST_MCOL + i,
                     f"=({cl}{R_INDIA}/{ref(A['india_arpu'])}/{ref(A['seats'])})+({cl}{R_US}/{ref(A['us_arpu'])}/{ref(A['seats'])})",
                     fmt=FMT_INT)

    return ws, R_MRR, R_PAY


def build_cogs(wb, rev_mrr_row, rev_pay_row):
    ws = wb.create_sheet("COGS")
    ws.sheet_properties.tabColor = "7C3AED"
    label(ws, 1, 1, "COGS — Formulas reference Revenue Build", bold=True)
    setup_month_headers(ws)

    R_AI, R_INFRA, R_STRIPE, R_TOT, R_GP, R_GM = 5, 6, 7, 8, 9, 10
    rev = "'Revenue Build'"

    for row, text in [(R_AI, "AI inference"), (R_INFRA, "Cloud infra"), (R_STRIPE, "Stripe fees"),
                      (R_TOT, "TOTAL COGS"), (R_GP, "Gross profit"), (R_GM, "Gross margin %")]:
        label(ws, row, 1, text, bold=(row >= R_TOT))
        formula_cell(ws, row, 2, sum_formula(row), bold=(row >= R_TOT))

    for i in range(N_MCOLS):
        col = mcol(i)
        c = FIRST_MCOL + i
        rev_ref = f"{rev}!{col}{rev_mrr_row}"
        pay_ref = f"{rev}!{col}{rev_pay_row}"
        formula_cell(ws, R_AI, c, f"={rev_ref}*{ai_pct_formula(col)}")
        formula_cell(ws, R_INFRA, c, f"={rev_ref}*{ref(A['infra_pct'])}")
        formula_cell(ws, R_STRIPE, c, f"={rev_ref}*{ref(A['stripe_pct'])}+{pay_ref}*0.3")
        formula_cell(ws, R_TOT, c, f"={col}{R_AI}+{col}{R_INFRA}+{col}{R_STRIPE}", bold=True)
        formula_cell(ws, R_GP, c, f"={rev_ref}-{col}{R_TOT}", bold=True)
        formula_cell(ws, R_GM, c, f"=IF({rev_ref}=0,0,{col}{R_GP}/{rev_ref})", fmt=FMT_PCT)

    return ws, R_TOT, R_GP


def build_opex(wb, rev_mrr_row):
    ws = wb.create_sheet("OpEx")
    ws.sheet_properties.tabColor = "DC2626"
    label(ws, 1, 1, "OPERATING EXPENSES — Formula-driven", bold=True)
    setup_month_headers(ws)

    R_MKT, R_SAL, R_OFF, R_TOOLS, R_TOT = 5, 6, 7, 8, 9
    rev = "'Revenue Build'"
    hc = "'Headcount Plan'"

    label(ws, R_MKT, 1, "Marketing")
    label(ws, R_SAL, 1, "Salaries & benefits")
    label(ws, R_OFF, 1, "Office & facilities")
    label(ws, R_TOOLS, 1, "Tools & SaaS")
    label(ws, R_TOT, 1, "TOTAL OpEx", bold=True)

    for row in [R_MKT, R_SAL, R_OFF, R_TOOLS, R_TOT]:
        formula_cell(ws, row, 2, sum_formula(row), bold=(row == R_TOT))

    for i in range(N_MCOLS):
        col = mcol(i)
        c = FIRST_MCOL + i
        rev_ref = f"{rev}!{col}{rev_mrr_row}"
        formula_cell(ws, R_MKT, c, f"={rev_ref}*{mkt_pct_formula(col)}")
        formula_cell(ws, R_SAL, c, f"={hc}!{col}50")
        m = f"{col}$3"
        formula_cell(ws, R_OFF, c,
                     f"=IF({m}<12,500,IF({m}<24,3500,15000))")
        formula_cell(ws, R_TOOLS, c,
                     f"=IF({m}<12,1000,IF({m}<24,5000,12500))")
        formula_cell(ws, R_TOT, c,
                     f"={col}{R_MKT}+{col}{R_SAL}+{col}{R_OFF}+{col}{R_TOOLS}", bold=True)

    return ws, R_TOT


def build_headcount(wb):
    ws = wb.create_sheet("Headcount Plan")
    ws.sheet_properties.tabColor = "B45309"
    label(ws, 1, 1, "HEADCOUNT — Role inputs; row 50 = total salaries (→ OpEx)", bold=True)
    setup_month_headers(ws, hdr_row=2, idx_row=3)

    label(ws, 4, 1, "Role")
    label(ws, 4, 2, "Dept")
    label(ws, 4, 3, "Loc")
    ws.cell(4, 4, "Start").fill = HEADER_FILL
    ws.cell(4, 5, "End").fill = HEADER_FILL
    ws.cell(4, 6, "Base $/mo").fill = HEADER_FILL
    ws.cell(4, 7, "Loaded $/mo").fill = HEADER_FILL

    row = 5
    first_role = row
    for role_data in ALL_HIRES:
        role, dept, loc, start, end, base_usd, is_contr = role_data
        is_incr = role in INCREMENTAL_SALARY_ROLES
        if is_incr and base_usd == 0:
            base_usd = inr_to_usd(INCREMENTAL_SALARY_ROLES[role]["tiers_inr"][-1][1])
        label(ws, row, 1, role)
        ws.cell(row, 2, dept).border = BORDER
        ws.cell(row, 3, loc).border = BORDER
        input_cell(ws, row, 4, start, FMT_INT)
        input_cell(ws, row, 5, end, FMT_INT)
        if is_incr:
            ws.cell(row, 6, "MRR-tiered").border = BORDER
            ws.cell(row, 6).alignment = Alignment(horizontal="left")
        else:
            input_cell(ws, row, 6, base_usd, FMT_USD)
            formula_cell(ws, row, 7, f'=IF(C{row}="US",F{row}*1.25,F{row}*1.15)')
        for i in range(N_MCOLS):
            col = mcol(i)
            c = FIRST_MCOL + i
            if is_incr:
                sal = mrr_tier_salary_formula(col, role, loc)
                formula_cell(ws, row, c,
                             f'=IF(AND({col}$3>=D{row},{col}$3<=E{row}),{sal[1:]},0)')
            else:
                formula_cell(ws, row, c,
                             f'=IF(AND({col}$3>=D{row},{col}$3<=E{row}),G{row},0)')
        if is_incr:
            exit_col = mcol(N_MCOLS - 1)
            formula_cell(ws, row, 7, f"={exit_col}{row}")
        row += 1

    total_row = 50
    label(ws, total_row, 1, "TOTAL SALARIES (→ OpEx)", bold=True)
    for i in range(N_MCOLS):
        col = mcol(i)
        c = FIRST_MCOL + i
        formula_cell(ws, total_row, c,
                     f"=SUM({col}{first_role}:{col}{row-1})", bold=True)
    return ws


def build_monthly_pl(wb, rev_mrr, cogs_gp, opex_tot):
    ws = wb.create_sheet("Monthly P&L")
    ws.sheet_properties.tabColor = NAVY_HEX
    label(ws, 1, 1, "MONTHLY P&L — All formulas", bold=True)
    setup_month_headers(ws)

    rev, cogs, opex = "'Revenue Build'", "'COGS'", "'OpEx'"
    R_REV, R_COGS, R_GP = 5, 6, 7
    R_MKT, R_SAL, R_OPEX, R_EBITDA = 8, 9, 10, 11
    R_DIV, R_NET = 12, 13

    mapping = [
        (R_REV, "Revenue (MRR)", f"{rev}!{{col}}{rev_mrr}", False),
        (R_COGS, "COGS", f"-{cogs}!{{col}}8", False),
        (R_GP, "Gross profit", f"{rev}!{{col}}{rev_mrr}+{cogs}!{{col}}8", True),
        (R_MKT, "Marketing", f"-{opex}!{{col}}5", False),
        (R_SAL, "Salaries", f"-{opex}!{{col}}6", False),
        (R_OPEX, "Other OpEx", f"-({opex}!{{col}}7+{opex}!{{col}}8)", False),
        (R_EBITDA, "EBITDA", f"={get_column_letter(FIRST_MCOL)}{R_GP}+{get_column_letter(FIRST_MCOL)}{R_MKT}+{get_column_letter(FIRST_MCOL)}{R_SAL}+{get_column_letter(FIRST_MCOL)}{R_OPEX}", True),
    ]

    for row, text, _, bold in mapping:
        label(ws, row, 1, text, bold=bold)
        formula_cell(ws, row, 2, sum_formula(row), bold=bold)

    for i in range(N_MCOLS):
        col = mcol(i)
        c = FIRST_MCOL + i
        formula_cell(ws, R_REV, c, f"={rev}!{col}{rev_mrr}")
        formula_cell(ws, R_COGS, c, f"=-{cogs}!{col}8")
        formula_cell(ws, R_GP, c, f"={col}{R_REV}+{col}{R_COGS}", bold=True)
        formula_cell(ws, R_MKT, c, f"=-{opex}!{col}5")
        formula_cell(ws, R_SAL, c, f"=-{opex}!{col}6")
        formula_cell(ws, R_OPEX, c, f"=-({opex}!{col}7+{opex}!{col}8)")
        formula_cell(ws, R_EBITDA, c,
                     f"={col}{R_GP}+{col}{R_MKT}+{col}{R_SAL}+{col}{R_OPEX}", bold=True)
        # Dividends: 20% annual gross profit, paid each June (idx 11, 23, 35)
        if i in (11, 23, 35):
            start_col = mcol(i - 11)
            formula_cell(ws, R_DIV, c,
                         f"=-SUM({start_col}{R_GP}:{col}{R_GP})*{ref(A['div_pct'])}")
        else:
            formula_cell(ws, R_DIV, c, "=0")
        formula_cell(ws, R_NET, c, f"={col}{R_EBITDA}+{col}{R_DIV}", bold=True)

    return ws, R_EBITDA, R_DIV, R_GP


def build_annual(wb, pl_ebitda, pl_div, pl_gp, rev_arr_row):
    ws = wb.create_sheet("Annual")
    ws.sheet_properties.tabColor = NAVY_HEX
    rev = "'Revenue Build'"
    pl = "'Monthly P&L'"

    label(ws, 1, 1, "ANNUAL SUMMARY — SUM formulas by fiscal year", bold=True)
    headers = ["Metric", "Year 1", "Year 2", "Year 3", "Y2 vs Y1", "Y3 vs Y2"]
    for c, h in enumerate(headers, 1):
        ws.cell(2, c, h).fill = HEADER_FILL
        ws.cell(2, c, h).font = hdr_font(10)

    years = [(0, 11), (12, 23), (24, 35)]

    def yr_sum(sheet, row, s, e):
        refs = "+".join(f"{sheet}!{mcol(i)}{row}" for i in range(s, e + 1))
        return f"={refs}"

    metrics = [
        ("Revenue (annual)", pl, 5),
        ("Gross profit", pl, pl_gp),
        ("EBITDA", pl, pl_ebitda),
        ("Shareholder dividends", pl, pl_div),
        ("Exit MRR", rev, 5),
        ("Exit ARR", rev, rev_arr_row),
    ]
    r = 3
    for name, sheet, row in metrics:
        label(ws, r, 1, name, bold="Exit" in name)
        yvals = []
        for j, (s, e) in enumerate(years):
            if "Exit" in name:
                f = f"={sheet}!{mcol(e)}{row}"
            else:
                f = yr_sum(sheet, row, s, e)
            formula_cell(ws, r, 2 + j, f, bold="Exit" in name)
            yvals.append(get_column_letter(2 + j) + str(r))
        formula_cell(ws, r, 5, f"=IFERROR(({yvals[1]}-{yvals[0]})/ABS({yvals[0]}),\"\")", fmt=FMT_PCT)
        formula_cell(ws, r, 6, f"=IFERROR(({yvals[2]}-{yvals[1]})/ABS({yvals[1]}),\"\")", fmt=FMT_PCT)
        r += 1

    ws.column_dimensions["A"].width = 28


def build_cashflow(wb, pl_ebitda, pl_div):
    ws = wb.create_sheet("Cash Flow")
    ws.sheet_properties.tabColor = "1E40AF"
    label(ws, 1, 1, "CASH FLOW — Formula-driven", bold=True)
    setup_month_headers(ws)

    pl = "'Monthly P&L'"
    R_OCF, R_CAPEX, R_FUND, R_DIV, R_CASH = 5, 6, 7, 8, 9

    label(ws, R_OCF, 1, "Operating CF (EBITDA)")
    label(ws, R_CAPEX, 1, "CapEx")
    label(ws, R_FUND, 1, "Fundraising")
    label(ws, R_DIV, 1, "Dividends paid")
    label(ws, R_CASH, 1, "Ending cash", bold=True)

    for row in [R_OCF, R_CAPEX, R_FUND, R_DIV, R_CASH]:
        formula_cell(ws, row, 2, sum_formula(row), bold=(row == R_CASH))

    for i in range(N_MCOLS):
        col = mcol(i)
        c = FIRST_MCOL + i
        m = f"{col}$3"
        formula_cell(ws, R_OCF, c, f"={pl}!{col}{pl_ebitda}")
        formula_cell(ws, R_CAPEX, c, f"=IF({m}=8,2000,IF({m}=18,5000,IF({m}=30,10000,0)))")
        # Fundraising: sum if month index matches assumption months
        formula_cell(ws, R_FUND, c,
                     f"=IF({m}={ref(A['angel_mo'])},{ref(A['angel'])},0)"
                     f"+IF({m}={ref(A['seed_mo'])},IF({ref(A['scenario'])}=\"Scale\",{ref(A['seed_scale'])},{ref(A['seed'])}),0)"
                     f"+IF({m}={ref(A['series_a_mo'])},IF({ref(A['scenario'])}=\"Scale\",{ref(A['series_a_scale'])},{ref(A['series_a'])}),0)"
                     f"+IF({m}={ref(A['series_b_mo'])},IF({ref(A['scenario'])}=\"Scale\",{ref(A['series_b'])},0),0)")
        formula_cell(ws, R_DIV, c, f"=-{pl}!{col}{pl_div}")
        if i == 0:
            formula_cell(ws, R_CASH, c,
                         f"={ref(A['starting_cash'])}+{col}{R_OCF}-{col}{R_CAPEX}+{col}{R_FUND}+{col}{R_DIV}",
                         bold=True)
        else:
            prev = mcol(i - 1)
            formula_cell(ws, R_CASH, c,
                         f"={prev}{R_CASH}+{col}{R_OCF}-{col}{R_CAPEX}+{col}{R_FUND}+{col}{R_DIV}",
                         bold=True)


def build_dashboard(wb):
    ws = wb.create_sheet("Dashboard")
    ws.sheet_properties.tabColor = TEAL_HEX
    ws.sheet_view.showGridLines = False
    label(ws, 1, 1, "UMBRELLA FINANCIAL DASHBOARD", bold=True)
    ws.merge_cells("A1:F1")

    label(ws, 3, 1, "Active scenario")
    formula_cell(ws, 3, 2, f"={ref(A['scenario'])}", fmt="@")

    metrics = [
        ("Active Y3 exit MRR", f"={ref(A['y3_active'])}"),
        ("Active Y3 ARR", f"={ref(A['y3_active'])}*12"),
        ("Y1 Revenue (Annual!B3)", "='Annual'!B3"),
        ("Y3 Revenue (Annual!D3)", "='Annual'!D3"),
        ("Y3 EBITDA (Annual!D5)", "='Annual'!D5"),
        ("Ending cash Jun 2029", f"='Cash Flow'!{mcol(35)}9"),
    ]
    for i, (lbl, f) in enumerate(metrics, 5):
        label(ws, i, 1, lbl)
        formula_cell(ws, i, 2, f, bold=True)

    ws.column_dimensions["A"].width = 30
    ws.column_dimensions["B"].width = 18


def main():
    wb = Workbook()
    build_assumptions(wb)
    build_scenarios(wb)
    build_dashboard(wb)
    _, rev_mrr, rev_pay = build_revenue(wb)
    _, _, _ = build_cogs(wb, rev_mrr, rev_pay)
    build_headcount(wb)
    _, opex_tot = build_opex(wb, rev_mrr)
    _, pl_ebitda, pl_div, pl_gp = build_monthly_pl(wb, rev_mrr, 9, opex_tot)
    build_annual(wb, pl_ebitda, pl_div, pl_gp, 11)
    build_cashflow(wb, pl_ebitda, pl_div)

    # Reorder sheets
    order = ["Dashboard", "Assumptions", "Scenarios", "Revenue Build", "COGS",
             "Headcount Plan", "OpEx", "Monthly P&L", "Annual", "Cash Flow"]
    for i, name in enumerate(order):
        wb.move_sheet(name, offset=i - wb.sheetnames.index(name))

    wb.save(OUTPUT)
    print(f"✓ Saved formula-driven model: {OUTPUT}")
    print(f"  Toggle scenario on Assumptions!B5: 'Base' or 'Scale'")
    print(f"  Base Y3: ${Y3_EXIT_MRR_BASE:,} MRR (${Y3_EXIT_MRR_BASE*12:,} ARR)")
    print(f"  Scale Y3: ${Y3_EXIT_MRR_SCALE:,.0f} MRR ($50M ARR)")


if __name__ == "__main__":
    main()
