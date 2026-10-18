#!/usr/bin/env python3
"""Generate influencer PDF variants from INFLUENCER-REEL-SCRIPTS-INDIA-BASE.md"""

import argparse
import re
import sys
from pathlib import Path

from fpdf import FPDF

DIR = Path(__file__).parent
BASE_MD = DIR / "INFLUENCER-REEL-SCRIPTS-INDIA-BASE.md"
FONT_PATH = "/System/Library/Fonts/Supplemental/Arial Unicode.ttf"
REPO_ROOT = DIR.parent.parent
LOGO_DARK = REPO_ROOT / "legal_web/public/brand/umbrella-logo-dark.png"
LOGO_LIGHT = REPO_ROOT / "legal_web/public/brand/umbrella-logo-light.png"
LOGO_DARK_ASPECT = 1024 / 416
LOGO_LIGHT_ASPECT = 1024 / 432

NAVY = (15, 23, 42)
TEAL = (13, 148, 136)
SLATE = (71, 85, 105)
LIGHT_BG = (248, 250, 252)
WHITE = (255, 255, 255)

EMOJI_REPLACEMENTS = {
    "₹": "Rs ",
    "✅": "[YES]",
    "❌": "[NO]",
    "⚡": "",
    "⏳": "",
    "📚": "",
    "⚠️": "[!]",
    "⚠": "[!]",
    "🎯": "",
    "📄": "",
    "⚖️": "",
    "⚖": "",
    "🌂": "",
    "👇": "->",
    "🔗": "Link:",
    "📱": "",
    "☑": "[x]",
    "☐": "[ ]",
    "✓": "[YES]",
}


class InfluencerPDF(FPDF):
    def __init__(self, reel_amount: str):
        super().__init__()
        self.reel_amount = reel_amount
        self.add_font("ArialUni", "", FONT_PATH)
        self.add_font("ArialUni", "B", FONT_PATH)
        self.set_auto_page_break(auto=True, margin=20)

    def header(self):
        if self.page_no() > 1:
            logo_h = 8
            logo_w = logo_h * LOGO_LIGHT_ASPECT
            self.image(str(LOGO_LIGHT), x=10, y=8, w=logo_w, h=logo_h)
            self.set_xy(10 + logo_w + 4, 9)
            self.set_font("ArialUni", "", 8)
            self.set_text_color(*SLATE)
            self.cell(0, 6, "India Influencer Reel Scripts", align="L")
            self.set_xy(-30, 9)
            self.cell(20, 6, f"Page {self.page_no()}", align="R")
            self.set_draw_color(*TEAL)
            self.line(10, 18, 200, 18)
            self.ln(10)

    def footer(self):
        self.set_y(-15)
        self.set_font("ArialUni", "", 7)
        self.set_text_color(*SLATE)
        self.cell(0, 10, "Umbrella by Okay Legal · g.jain@okaylegal.ai · Confidential — Influencer Partners Only", align="C")

    def cover_page(self):
        self.add_page()
        self.set_fill_color(*NAVY)
        self.rect(0, 0, 210, 297, "F")

        logo_h = 24
        logo_w = logo_h * LOGO_DARK_ASPECT
        logo_x = (210 - logo_w) / 2
        self.image(str(LOGO_DARK), x=logo_x, y=42, w=logo_w, h=logo_h)

        self.set_y(78)
        self.set_font("ArialUni", "", 16)
        self.set_text_color(200, 220, 230)
        self.multi_cell(0, 10, "India Influencer Reel Scripts", align="C")
        self.ln(4)
        self.set_font("ArialUni", "", 12)
        self.multi_cell(0, 8, "Lawyer-Focused Creator Kit (Hinglish)", align="C")
        self.ln(20)
        self.set_fill_color(*TEAL)
        self.set_x(30)
        self.set_font("ArialUni", "B", 11)
        self.cell(150, 12, f"  {self.reel_amount} per reel  |  Rs 500/firm  Rs 200/individual", fill=True, align="C")
        self.ln(30)
        self.set_font("ArialUni", "", 10)
        self.set_text_color(180, 200, 210)
        self.multi_cell(0, 7, "8 ready-to-shoot scripts · Web + Mobile demos\nHinglish voiceover · Captions · Hashtags · Disclaimers", align="C")
        self.ln(20)
        self.set_font("ArialUni", "", 9)
        self.multi_cell(0, 6, "Version 1.1 · July 2026\nhttps://umbrella.okaylegal.ai", align="C")

    def section_title(self, text, level=1):
        if level == 1:
            self.ln(6)
            self.set_fill_color(*NAVY)
            self.set_font("ArialUni", "B", 14)
            self.set_text_color(*WHITE)
            self.multi_cell(0, 10, f"  {text}", fill=True)
            self.ln(3)
        elif level == 2:
            self.ln(4)
            self.set_font("ArialUni", "B", 12)
            self.set_text_color(*NAVY)
            self.multi_cell(0, 8, text)
            self.set_draw_color(*TEAL)
            self.line(10, self.get_y(), 80, self.get_y())
            self.ln(4)
        else:
            self.ln(2)
            self.set_font("ArialUni", "B", 10)
            self.set_text_color(*TEAL)
            self.multi_cell(0, 7, text)
            self.ln(2)

    def body_text(self, text):
        self.set_font("ArialUni", "", 9)
        self.set_text_color(30, 41, 59)
        self.multi_cell(0, 5.5, text)
        self.ln(2)

    def quote_block(self, text):
        self.set_fill_color(*LIGHT_BG)
        self.set_font("ArialUni", "", 9)
        self.set_text_color(30, 41, 59)
        self.set_x(self.get_x() + 4)
        self.multi_cell(186, 5.5, text, fill=True)
        self.ln(3)

    def _wrap_text(self, text: str, max_width: float) -> list[str]:
        if not text:
            return [""]
        words = text.split(" ")
        lines: list[str] = []
        current = ""
        for word in words:
            candidate = f"{current} {word}".strip()
            if self.get_string_width(candidate) <= max_width:
                current = candidate
            else:
                if current:
                    lines.append(current)
                current = word
        if current:
            lines.append(current)
        return lines or [text]

    def _col_widths(self, col_count: int) -> list[float]:
        table_w = 190.0
        if col_count == 2:
            return [62.0, 128.0]
        if col_count == 3:
            return [42.0, 58.0, 90.0]
        return [table_w / col_count] * col_count

    def table_row(self, cols, header=False):
        col_widths = self._col_widths(len(cols))
        x_start = self.get_x()
        y_start = self.get_y()
        line_h = 4.8
        pad = 2.0

        if header:
            self.set_fill_color(*NAVY)
            self.set_text_color(*WHITE)
            self.set_font("ArialUni", "B", 8)
        else:
            self.set_fill_color(*LIGHT_BG)
            self.set_text_color(30, 41, 59)
            self.set_font("ArialUni", "", 8)

        wrapped = [
            self._wrap_text(col, w - 2 * pad) for col, w in zip(cols, col_widths)
        ]
        row_h = max(len(lines) for lines in wrapped) * line_h + 2 * pad

        if y_start + row_h > 277:
            self.add_page()
            y_start = self.get_y()

        for i, (lines, w) in enumerate(zip(wrapped, col_widths)):
            x = x_start + sum(col_widths[:i])
            fill = NAVY if header else LIGHT_BG
            self.set_fill_color(*fill)
            self.set_draw_color(200, 210, 220)
            self.rect(x, y_start, w, row_h, style="FD")
            for j, line in enumerate(lines):
                self.set_xy(x + pad, y_start + pad + j * line_h)
                if header:
                    self.set_text_color(*WHITE)
                    self.set_font("ArialUni", "B", 8)
                else:
                    self.set_text_color(30, 41, 59)
                    self.set_font("ArialUni", "", 8)
                self.cell(w - 2 * pad, line_h, line)

        self.set_xy(x_start, y_start + row_h)

    def bullet(self, text):
        self.set_font("ArialUni", "", 9)
        self.set_text_color(30, 41, 59)
        self.cell(6, 5.5, chr(8226))
        self.multi_cell(184, 5.5, text)
        self.ln(1)

    def checkbox(self, text):
        self.set_font("ArialUni", "", 9)
        self.set_text_color(30, 41, 59)
        self.cell(6, 5.5, chr(9744))
        self.multi_cell(184, 5.5, text)
        self.ln(1)

    def code_block(self, text):
        self.set_fill_color(241, 245, 249)
        self.set_font("ArialUni", "", 8)
        self.set_text_color(30, 41, 59)
        self.multi_cell(0, 5, text, fill=True)
        self.ln(3)


def strip_md(text):
    text = re.sub(r"\*\*(.+?)\*\*", r"\1", text)
    text = re.sub(r"\*(.+?)\*", r"\1", text)
    text = re.sub(r"`(.+?)`", r"\1", text)
    text = re.sub(r"\[(.+?)\]\((.+?)\)", r"\1 (\2)", text)
    for emoji, repl in EMOJI_REPLACEMENTS.items():
        text = text.replace(emoji, repl)
    return text.strip()


def render_md_to_pdf(content: str, pdf_path: Path, reel_amount: str):
    pdf = InfluencerPDF(reel_amount=reel_amount)
    pdf.cover_page()

    lines = content.split("\n")
    i = 0
    in_code = False
    code_buf = []
    in_table = False
    table_rows = []

    while i < len(lines):
        line = lines[i]
        stripped = line.strip()

        if i < 10 and (stripped.startswith("# ") or stripped == "---"):
            i += 1
            continue

        if stripped.startswith("```"):
            if in_code:
                pdf.code_block(strip_md("\n".join(code_buf)))
                code_buf = []
                in_code = False
            else:
                in_code = True
            i += 1
            continue

        if in_code:
            code_buf.append(stripped)
            i += 1
            continue

        if stripped.startswith("|") and "|" in stripped[1:]:
            if not in_table:
                in_table = True
                table_rows = []
            cells = [strip_md(c.strip()) for c in stripped.split("|")[1:-1]]
            if all(set(c) <= set("-: ") for c in cells):
                i += 1
                continue
            table_rows.append(cells)
            i += 1
            if i < len(lines) and lines[i].strip().startswith("|"):
                continue
            for j, row in enumerate(table_rows):
                pdf.set_x(10)
                pdf.table_row(row, header=(j == 0))
            table_rows = []
            in_table = False
            pdf.ln(2)
            continue

        if stripped == "---":
            pdf.ln(2)
            i += 1
            continue

        if stripped.startswith("# "):
            pdf.add_page()
            pdf.section_title(strip_md(stripped[2:]), level=1)
        elif stripped.startswith("## "):
            pdf.section_title(strip_md(stripped[3:]), level=2)
        elif stripped.startswith("### "):
            pdf.section_title(strip_md(stripped[4:]), level=3)
        elif stripped.startswith("#### "):
            pdf.set_font("ArialUni", "B", 9)
            pdf.set_text_color(*NAVY)
            pdf.multi_cell(0, 6, strip_md(stripped[5:]))
            pdf.ln(2)
        elif stripped.startswith("> "):
            pdf.quote_block(strip_md(stripped[2:]))
        elif stripped.startswith("- [ ] "):
            pdf.checkbox(strip_md(stripped[6:]))
        elif stripped.startswith("- ") or stripped.startswith("* "):
            pdf.bullet(strip_md(stripped[2:]))
        elif stripped:
            pdf.body_text(strip_md(stripped))

        i += 1

    pdf.output(str(pdf_path))
    print(f"PDF written to {pdf_path}")


def write_variant(amount: int) -> tuple[Path, Path]:
    amount_str = f"Rs {amount:,}"
    md_path = DIR / f"INFLUENCER-REEL-SCRIPTS-INDIA-{amount}.md"
    pdf_path = DIR / f"INFLUENCER-REEL-SCRIPTS-INDIA-{amount}.pdf"

    base = BASE_MD.read_text(encoding="utf-8")
    content = base.replace("{{REEL_AMOUNT}}", f"₹{amount:,}")
    md_path.write_text(content, encoding="utf-8")
    render_md_to_pdf(content, pdf_path, amount_str)
    return md_path, pdf_path


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--amount", type=int, help="Single variant amount e.g. 2000")
    parser.add_argument("--all", action="store_true", help="Generate 2000 and 3000 variants")
    args = parser.parse_args()

    if args.all or not args.amount:
        for amount in (2000, 3000):
            write_variant(amount)
    else:
        write_variant(args.amount)


if __name__ == "__main__":
    main()
