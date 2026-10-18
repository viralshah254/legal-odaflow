"""Generate diagram PNGs for Umbrella business plan."""

from pathlib import Path

import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from matplotlib.patches import FancyBboxPatch, FancyArrowPatch

DIR = Path(__file__).parent
DIAGRAMS = DIR / "plan-diagrams"
DIAGRAMS.mkdir(exist_ok=True)

NAVY = "#0F172A"
TEAL = "#0D9488"
SLATE = "#475569"
LIGHT = "#F8FAFC"
ACCENT = "#14B8A6"
ORANGE = "#F59E0B"
BLUE = "#3B82F6"


def _save(fig, name):
    path = DIAGRAMS / name
    fig.savefig(path, dpi=150, bbox_inches="tight", facecolor="white")
    plt.close(fig)
    return path


def three_year_expansion():
    fig, ax = plt.subplots(figsize=(10, 4))
    ax.set_xlim(0, 10)
    ax.set_ylim(0, 4)
    ax.axis("off")
    ax.set_title("Umbrella Global Expansion — 3-Year Roadmap", fontsize=14, fontweight="bold", color=NAVY, pad=12)

    phases = [
        (0.3, 2.5, 2.8, 1.2, "YEAR 1\nJul 2026 – Jun 2027", TEAL, "INDIA\n(primary wedge)\n+\nUS\n(ARPU + credibility)"),
        (3.5, 2.5, 2.8, 1.2, "YEAR 2\nJul 2027 – Jun 2028", BLUE, "US HEAVY\n+\nIndia scale\n+\nUK · CA · AU"),
        (6.7, 2.5, 2.8, 1.2, "YEAR 3\nJul 2028 – Jun 2029", NAVY, "REST OF WORLD\nEU · LATAM\nAPAC · MENA"),
    ]
    for x, y, w, h, title, color, body in phases:
        box = FancyBboxPatch((x, y), w, h, boxstyle="round,pad=0.05", facecolor=color, edgecolor="white", alpha=0.9)
        ax.add_patch(box)
        ax.text(x + w / 2, y + h - 0.22, title, ha="center", va="top", fontsize=8, fontweight="bold", color="white")
        ax.text(x + w / 2, y + h / 2 - 0.1, body, ha="center", va="center", fontsize=9, color="white", linespacing=1.4)

    for x1, x2 in [(3.1, 3.5), (6.3, 6.7)]:
        ax.annotate("", xy=(x2, 3.1), xytext=(x1, 3.1),
                    arrowprops=dict(arrowstyle="->", color=SLATE, lw=2))

    ax.text(5, 0.6, "Global TAM: $800B+ legal services · Legal tech: $28B+ by 2028 · AI legal: fastest-growing segment",
            ha="center", fontsize=9, color=SLATE, style="italic")
    return _save(fig, "01-three-year-expansion.png")


def growth_flywheel():
    fig, ax = plt.subplots(figsize=(8, 8))
    ax.set_xlim(-2, 2)
    ax.set_ylim(-2, 2)
    ax.axis("off")
    ax.set_title("Umbrella Growth Flywheel", fontsize=14, fontweight="bold", color=NAVY, pad=12)

    nodes = [
        (0, 1.4, "Consumer\nIssue Checker\n(free wedge)", TEAL),
        (1.2, 0.4, "Lawyer receives\npre-analyzed lead", BLUE),
        (0.7, -1.1, "Lawyer subscribes\nto Umbrella OS", NAVY),
        (-0.7, -1.1, "Lawyer drafts faster\n+ wins clients", ORANGE),
        (-1.2, 0.4, "Lawyer shares\nchecker with clients", ACCENT),
    ]
    for x, y, label, color in nodes:
        circle = plt.Circle((x, y), 0.55, color=color, alpha=0.85)
        ax.add_patch(circle)
        ax.text(x, y, label, ha="center", va="center", fontsize=8, color="white", fontweight="bold")

    coords = [(0, 1.4), (1.2, 0.4), (0.7, -1.1), (-0.7, -1.1), (-1.2, 0.4), (0, 1.4)]
    for i in range(len(coords) - 1):
        x1, y1 = coords[i]
        x2, y2 = coords[i + 1]
        ax.annotate("", xy=(x2, y2), xytext=(x1, y1),
                    arrowprops=dict(arrowstyle="->", color=SLATE, lw=1.8,
                                    connectionstyle="arc3,rad=0.15"))

    ax.text(0, -1.85, "Each turn of the flywheel reduces CAC and increases LTV", ha="center", fontsize=9, color=SLATE)
    return _save(fig, "02-growth-flywheel.png")


def org_structure():
    fig, ax = plt.subplots(figsize=(10, 5))
    ax.set_xlim(0, 10)
    ax.set_ylim(0, 5)
    ax.axis("off")
    ax.set_title("Organization Structure — Year 1", fontsize=14, fontweight="bold", color=NAVY, pad=12)

    def box(x, y, w, h, text, color):
        b = FancyBboxPatch((x, y), w, h, boxstyle="round,pad=0.04", facecolor=color, edgecolor="white")
        ax.add_patch(b)
        ax.text(x + w / 2, y + h / 2, text, ha="center", va="center", fontsize=8, color="white", fontweight="bold")

    box(3.5, 4.0, 3, 0.7, "BOARD / ADVISORS (post-seed)", SLATE)
    box(1.0, 2.8, 3.2, 0.9, "Co-CEO / CTO\nEngineering · Product · Tech", TEAL)
    box(5.8, 2.8, 3.2, 0.9, "Garima — Co-CEO / CFO / CMO\nFinance · Marketing · Sales · Ops", BLUE)

    for x, label in [(0.5, "Backend / AI"), (2.0, "Web + Mobile"), (3.5, "DevOps / SOC2"), (5.3, "India GTM"), (6.8, "US GTM"), (8.3, "Finance / Legal")]:
        box(x, 1.2, 1.3, 0.7, label, NAVY)

    ax.plot([2.6, 2.6], [2.8, 1.9], color=SLATE, lw=1)
    ax.plot([7.4, 7.4], [2.8, 1.9], color=SLATE, lw=1)
    ax.text(5, 0.4, "Hire triggers: Marketing Mgr (200 activated) · CS (50 paying) · US BD (20 US betas)", ha="center", fontsize=8, color=SLATE)
    return _save(fig, "03-org-structure.png")


def fundraising_timeline():
    fig, ax = plt.subplots(figsize=(10, 4.5))
    ax.set_title("Fundraising Roadmap", fontsize=14, fontweight="bold", color=NAVY, pad=12)

    rounds = [
        ("Bootstrap\n(now)", 0, 0, TEAL),
        ("Friends &\nFamily / Angels\n$150–300K", 1, 150, BLUE),
        ("Seed\n$1.5–2.5M\nQ1 2027", 2, 2000, NAVY),
        ("Series A\n$8–12M\nQ1 2028", 3, 10000, ORANGE),
    ]
    amounts = [r[2] for r in rounds]
    labels = [r[0] for r in rounds]
    colors = [r[3] for r in rounds]
    x = range(len(rounds))

    bars = ax.bar(x, [max(a, 50) for a in amounts], color=colors, alpha=0.85, width=0.6)
    ax.set_xticks(x)
    ax.set_xticklabels(labels, fontsize=8)
    ax.set_ylabel("Raise Size ($K)", fontsize=10)
    ax.set_yscale("log")
    ax.set_ylim(30, 20000)
    ax.grid(axis="y", alpha=0.3)

    triggers = [
        "Product live\n10 lawyers",
        "100 lawyers\n$5K MRR",
        "$25K MRR\n40% D7 retention",
        "$150K MRR\nUS traction",
    ]
    for i, t in enumerate(triggers):
        ax.text(i, max(amounts[i], 50) * 1.3, t, ha="center", fontsize=7, color=SLATE)

    return _save(fig, "04-fundraising-timeline.png")


def tech_architecture():
    fig, ax = plt.subplots(figsize=(10, 5))
    ax.set_xlim(0, 10)
    ax.set_ylim(0, 5)
    ax.axis("off")
    ax.set_title("Technology Architecture — Current → Year 1 Target", fontsize=14, fontweight="bold", color=NAVY, pad=12)

    layers = [
        (0.3, 3.8, 9.4, 0.8, "CLIENTS: Web (Next.js) · Mobile (Flutter) · Consumer Issue Checker", TEAL),
        (0.3, 2.7, 9.4, 0.8, "API: NestJS modular monolith · Auth · Billing (Stripe) · Multi-tenant", BLUE),
        (0.3, 1.6, 4.5, 0.8, "AI: India Draft v1 [LIVE] · Research [BETA] · US Draft [BETA] · FIR [LIVE]", NAVY),
        (5.2, 1.6, 4.5, 0.8, "DATA: PostgreSQL · Redis queues · S3 docs · SOC2 path", SLATE),
        (0.3, 0.5, 9.4, 0.8, "INFRA: AWS · CI/CD · Monitoring · Feature flags · Model router", ORANGE),
    ]
    for x, y, w, h, text, color in layers:
        box = FancyBboxPatch((x, y), w, h, boxstyle="round,pad=0.03", facecolor=color, alpha=0.88, edgecolor="white")
        ax.add_patch(box)
        ax.text(x + w / 2, y + h / 2, text, ha="center", va="center", fontsize=8, color="white", fontweight="bold")
    return _save(fig, "05-tech-architecture.png")


def revenue_funnel():
    fig, ax = plt.subplots(figsize=(8, 6))
    ax.set_title("Revenue Funnel — Year 1 Targets", fontsize=14, fontweight="bold", color=NAVY, pad=12)

    stages = [
        ("Website visitors", 50000, TEAL),
        ("Lawyer sign-ups", 1500, BLUE),
        ("Activated (1+ action)", 900, NAVY),
        ("Trial engaged (D7 return)", 500, ACCENT),
        ("Paying subscribers", 200, ORANGE),
    ]
    y_pos = range(len(stages))
    values = [s[1] for s in stages]
    colors = [s[2] for s in stages]
    labels = [s[0] for s in stages]

    bars = ax.barh(y_pos, values, color=colors, alpha=0.85, height=0.6)
    ax.set_yticks(y_pos)
    ax.set_yticklabels(labels, fontsize=10)
    ax.invert_yaxis()
    ax.set_xlabel("Annual Volume (Year 1)", fontsize=10)
    for i, v in enumerate(values):
        ax.text(v + 500, i, f"{v:,}", va="center", fontsize=9, color=NAVY, fontweight="bold")
    ax.grid(axis="x", alpha=0.3)
    return _save(fig, "06-revenue-funnel.png")


def india_us_split():
    fig, ax = plt.subplots(figsize=(8, 5))
    ax.set_title("Year 1 Revenue Mix Target (Jun 2027)", fontsize=14, fontweight="bold", color=NAVY, pad=12)

    labels = ["India\n(subscriptions)", "US\n(subscriptions)", "India\n(consumer plus)", "Cross-sell\n& credits"]
    sizes = [45, 35, 12, 8]
    colors = [TEAL, BLUE, ACCENT, ORANGE]
    explode = (0.03, 0.05, 0, 0)
    ax.pie(sizes, explode=explode, labels=labels, colors=colors, autopct="%1.0f%%",
           startangle=90, textprops={"fontsize": 9})
    ax.text(0, -1.35, "Target MRR: $50,000 · India volume · US ARPU", ha="center", fontsize=9, color=SLATE)
    return _save(fig, "07-india-us-revenue-mix.png")


def monthly_mrr_growth():
    fig, ax = plt.subplots(figsize=(10, 4.5))
    ax.set_title("MRR Growth Projection — Year 1", fontsize=14, fontweight="bold", color=NAVY, pad=12)

    months = ["Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun"]
    india = [0.4, 1.5, 3, 5, 7, 9, 11, 14, 17, 20, 23, 27]
    us = [0.2, 0.5, 1, 2, 3.5, 5, 7, 9, 12, 15, 18, 21]
    x = range(12)
    ax.bar(x, india, label="India MRR ($K)", color=TEAL, alpha=0.85)
    ax.bar(x, us, bottom=india, label="US MRR ($K)", color=BLUE, alpha=0.85)
    ax.set_xticks(x)
    ax.set_xticklabels(months, fontsize=9)
    ax.set_ylabel("MRR ($K)", fontsize=10)
    ax.legend(loc="upper left", fontsize=9)
    ax.grid(axis="y", alpha=0.3)
    totals = [i + u for i, u in zip(india, us)]
    for i, t in enumerate(totals):
        ax.text(i, t + 0.5, f"${t}K", ha="center", fontsize=7, color=NAVY)
    return _save(fig, "08-mrr-growth.png")


def generate_all():
    paths = [
        three_year_expansion(),
        growth_flywheel(),
        org_structure(),
        fundraising_timeline(),
        tech_architecture(),
        revenue_funnel(),
        india_us_split(),
        monthly_mrr_growth(),
    ]
    return paths


if __name__ == "__main__":
    for p in generate_all():
        print(p)
