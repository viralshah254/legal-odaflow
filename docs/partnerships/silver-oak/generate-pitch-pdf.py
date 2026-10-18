#!/usr/bin/env python3
"""Generate the 2-page Silver Oak University pitch PDF."""

from pathlib import Path

from fpdf import FPDF

DIR = Path(__file__).parent
REPO_ROOT = DIR.parent.parent.parent
FONT_PATH = "/System/Library/Fonts/Supplemental/Arial Unicode.ttf"
LOGO_LIGHT = REPO_ROOT / "legal_web/public/brand/umbrella-logo-light.png"
LOGO_LIGHT_ASPECT = 1024 / 432
OUT = DIR / "silver-oak-pitch.pdf"

NAVY = (15, 23, 42)
TEAL = (13, 148, 136)
SLATE = (71, 85, 105)
LIGHT_BG = (248, 250, 252)
WHITE = (255, 255, 255)
BLUE = (37, 99, 235)


class PitchPDF(FPDF):
    def __init__(self):
        super().__init__()
        self.add_font("ArialUni", "", FONT_PATH)
        self.add_font("ArialUni", "B", FONT_PATH)
        self.set_auto_page_break(auto=True, margin=18)

    def footer(self):
        self.set_y(-14)
        self.set_font("ArialUni", "", 7)
        self.set_text_color(*SLATE)
        self.cell(
            0,
            8,
            "Umbrella by OkayLegal.ai  ·  g.jain@okaylegal.ai  ·  umbrella.okaylegal.ai  ·  YOUR RIGHTS. OUR MISSION.",
            align="C",
        )

    def _h1(self, text: str):
        self.set_font("ArialUni", "B", 16)
        self.set_text_color(*NAVY)
        self.multi_cell(0, 8, text)
        self.ln(2)

    def _h2(self, text: str):
        self.set_font("ArialUni", "B", 11)
        self.set_text_color(*TEAL)
        self.multi_cell(0, 6, text)
        self.ln(1)

    def _body(self, text: str):
        self.set_font("ArialUni", "", 9)
        self.set_text_color(*SLATE)
        self.multi_cell(0, 5, text)
        self.ln(1.5)

    def _bold_body(self, text: str):
        self.set_font("ArialUni", "B", 9)
        self.set_text_color(*NAVY)
        self.multi_cell(0, 5, text)
        self.ln(1)

    def _bullet(self, text: str):
        self.set_font("ArialUni", "", 9)
        self.set_text_color(*SLATE)
        x = self.get_x()
        self.cell(4, 5, "-")
        self.multi_cell(0, 5, text)
        self.set_x(x)
        self.ln(0.5)

    def _rule(self):
        self.set_draw_color(*TEAL)
        y = self.get_y()
        self.line(10, y, 200, y)
        self.ln(4)

    def page_one(self):
        self.add_page()
        # Header band
        self.set_fill_color(*NAVY)
        self.rect(0, 0, 210, 36, "F")
        if LOGO_LIGHT.exists():
            logo_h = 10
            logo_w = logo_h * LOGO_LIGHT_ASPECT
            self.image(str(LOGO_LIGHT), x=12, y=8, w=logo_w, h=logo_h)
        self.set_xy(12, 20)
        self.set_font("ArialUni", "B", 11)
        self.set_text_color(*WHITE)
        self.cell(0, 6, "Umbrella by OkayLegal.ai  |  Silver Oak University Pitch — Page 1 of 2")
        self.set_y(42)

        self._h1("Justice served to everyone.")
        self.set_font("ArialUni", "", 10)
        self.set_text_color(*BLUE)
        self.multi_cell(0, 5, "One platform. Equal support. For every legal need.")
        self.ln(3)
        self._rule()

        self._h2("About Us")
        self._body(
            "Umbrella by OkayLegal.ai is India's dual-sided legal AI platform — built so that "
            "legal clarity is not reserved for those who can afford expensive counsel."
        )
        self._body(
            "We help citizens understand their legal situation, research applicable law with real "
            "citations, and draft court-ready documents — in Hindi or English — before they ever "
            "step into a lawyer's chamber."
        )
        self._body(
            "We help lawyers and law firms run their entire practice on one AI-native platform: "
            "matter management, legal research, document drafting, billing, and client intake — "
            "connected in one workspace."
        )
        self._bold_body(
            "Our belief: Legal support should protect everyone, not just a few. "
            "Justice shouldn't be complicated. It should be accessible."
        )

        self._h2("What We Do — Three Pillars")
        # Mini table as bullets for reliability
        self._bold_body("DRAFT")
        self._bullet(
            "Citizens: Notices, petitions, bail applications, contracts — 394+ India court formats "
            "grounded in BNS, BNSS, and BSA 2023."
        )
        self._bullet(
            "Lawyers & students: AI-assisted drafting with jurisdiction-aware templates "
            "(including Gujarat-specific formats)."
        )
        self._bold_body("RESEARCH")
        self._bullet(
            "Citizens: Issue checker, section finder (IPC/BNS/BNSS), FIR analysis with cited authorities."
        )
        self._bullet("Lawyers & students: Verified legal research with statute and case-law citations.")
        self._bold_body("RESOLVE")
        self._bullet(
            "Citizens: Rights checker, risk analysis, and escalation to verified advocates when needed."
        )
        self._bullet("Lawyers & students: Matter-aware AI Copilot, strategy memos, and client guidance.")

        self._h2("Built for India — Relevant to Gujarat")
        self._bullet("394+ court draft formats — bail, writ petitions (Art. 226), consumer complaints, cheque bounce (NI Act 138), family petitions, and more.")
        self._bullet("New criminal code ready — grounded in BNS, BNSS, and BSA 2023 (replacing IPC/CrPC).")
        self._bullet("Gujarat-aware — Gujarat Rent Act notices, registration deed support, and state-level jurisdiction detection.")
        self._bullet("Multilingual — Hindi and English today; designed for India's linguistic diversity.")
        self._bullet("Free to start — students and citizens can explore issue checking and research at no cost.")

        self._h2("Who We Serve")
        self._body(
            "Individuals, solo advocates, law firms, in-house counsel, litigation teams, compliance "
            "officers, law students, and legal researchers — across district courts, high courts, "
            "and corporate legal departments."
        )

        self._h2("Company")
        self._bullet("Product: Umbrella by OkayLegal.ai")
        self._bullet("Platform: umbrella.okaylegal.ai")
        self._bullet("Built by: DVTech Ventures")
        self._bullet("Contact: Garima Jain — g.jain@okaylegal.ai")

    def page_two(self):
        self.add_page()
        self.set_fill_color(*NAVY)
        self.rect(0, 0, 210, 28, "F")
        if LOGO_LIGHT.exists():
            logo_h = 8
            logo_w = logo_h * LOGO_LIGHT_ASPECT
            self.image(str(LOGO_LIGHT), x=12, y=6, w=logo_w, h=logo_h)
        self.set_xy(12, 16)
        self.set_font("ArialUni", "B", 10)
        self.set_text_color(*WHITE)
        self.cell(0, 5, "Partnership Proposal  |  Silver Oak University — Page 2 of 2")
        self.set_y(34)

        self._h1("Guest Talk + Moot Court Proposal")
        self._rule()

        self._h2("A. Guest Talk (Primary Ask)")
        self._bold_body('Title: "Justice for Everyone: How AI Is Reshaping Law in Gujarat and India"')
        self._bullet("Format: 45–60 minutes (30–40 min talk + 15–20 min Q&A)")
        self._bullet("Speaker: Garima Jain, Umbrella by OkayLegal.ai")
        self._bullet("Audience: LLB / BA LLB students, faculty, moot court society members")

        self._bold_body("Talk outline")
        self._bullet("1. Opening — Why we built Umbrella (5 min)")
        self._bullet("2. Access to justice in India & Gujarat's role (8 min)")
        self._bullet("3. How AI transforms legal research, drafting & issue spotting — responsibly (12 min)")
        self._bullet("4. Live demo: India Drafts / citation-backed research (8 min)")
        self._bullet("5. What this means for law students in 2026+ (5 min)")
        self._bullet("6. Q&A (15–20 min)")

        self._bold_body("What we need from Silver Oak")
        self._bullet("Lecture hall / seminar room; mutually agreed date; optional faculty liaison")
        self._bold_body("What we offer")
        self._bullet("No cost · India-grounded practical content · optional free student access codes")

        self.ln(2)
        self._h2("B. Umbrella Moot Court Challenge (Follow-Up)")
        self._body(
            "After the guest session, we propose co-hosting a one- or two-day moot court where "
            "students argue a contemporary problem at the intersection of technology, access to "
            "justice, and constitutional/civil rights — with Umbrella providing tools and prizes."
        )
        self._bold_body("Structure")
        self._bullet("Written memorials + oral rounds; teams of 2 speakers + 1 researcher")
        self._bullet("Theme options: legal aid & technology; DPDP Act 2023; AI in judicial decision-making")
        self._bullet("Rounds: Prelims → Quarters → Semis → Finals")
        self._bullet("Judging: Faculty panel + practicing advocates (Umbrella can help invite Gujarat bar)")

        self._bold_body("Umbrella sponsorship")
        self._bullet("Platform access for research & drafting during the competition")
        self._bullet("Prizes: Best Team, Best Speaker, Best Memorial")
        self._bullet("Branding, social coverage, optional AI-assisted research workshop")

        self._bold_body("From Silver Oak")
        self._bullet("Venue · faculty / moot court coordinator · student registration · dates (4–6 weeks after talk)")

        self._bold_body("Suggested timeline")
        self._bullet("Week 1: Guest talk → Week 2: Planning → Week 3: Problem release → Week 4: Workshop → Week 5: Competition")

        self.ln(3)
        self.set_fill_color(*LIGHT_BG)
        self.set_x(10)
        self.cell(190, 18, "", fill=True)
        self.set_xy(14, self.get_y() - 15)
        self.set_font("ArialUni", "B", 9)
        self.set_text_color(*NAVY)
        self.multi_cell(
            182,
            5,
            "Next step: Confirm a date for the guest talk. We would welcome a short call with "
            "Dr. M. Samir Gopalan (Dean, School of Law) or the moot court committee.\n"
            "Contact: Garima Jain — g.jain@okaylegal.ai",
        )


def main():
    pdf = PitchPDF()
    pdf.page_one()
    pdf.page_two()
    pdf.output(str(OUT))
    print(f"Wrote {OUT}")


if __name__ == "__main__":
    main()
