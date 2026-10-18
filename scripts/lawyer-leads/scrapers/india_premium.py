"""Orchestrate premium India scrapers: top firms + ranked lawyers + contacts."""

from __future__ import annotations

from pathlib import Path

from models import ProspectRecord
from scrapers.advocatekhoj import scrape_advocatekhoj
from scrapers.chambers_india import scrape_chambers_india
from scrapers.iflr1000_india import scrape_iflr1000_india
from scrapers.india_bar_councils import scrape_india_bar_councils
from scrapers.india_dirs import scrape_india_dirs
from scrapers.justdial_india import scrape_justdial_india
from scrapers.law_asia import scrape_law_asia
from scrapers.legal500_india import scrape_legal500_india
from scrapers.osm import scrape_osm
from scrapers.probono_india import scrape_probono_advocates
from scrapers.sulekha_india import scrape_sulekha_india

FIRM_SOURCES = ("chambers_firm", "iflr1000_firm", "law_asia")
LAWYER_SOURCES = (
    "chambers_lawyer",
    "iflr1000_lawyer",
    "lawrato",
    "vakilsearch",
    "advocatekhoj",
    "justdial",
    "sulekha",
    "india_bar",
    "probono_nalsa",
    "osm",
)


def _is_firm(rec: ProspectRecord) -> bool:
    src = (rec.source or "").lower()
    if "firm" in src or src in ("law_asia",):
        return True
    if rec.organisation and rec.organisation == rec.full_name:
        return True
    return False


def _split_firms_lawyers(records: list[ProspectRecord]) -> tuple[list[ProspectRecord], list[ProspectRecord]]:
    firms: list[ProspectRecord] = []
    lawyers: list[ProspectRecord] = []
    for rec in records:
        if _is_firm(rec):
            firms.append(rec)
        else:
            lawyers.append(rec)
    return firms, lawyers


async def scrape_india_premium(
    data_dir: Path,
    *,
    firm_target: int = 2500,
    lawyer_target: int = 5000,
    include_directories: bool = True,
    include_osm: bool = True,
    include_biz_dirs: bool = True,
    max_volume: bool = False,
) -> list[ProspectRecord]:
    """
    Collect law firms and lawyers from premium + volume sources.
    When max_volume=True, return all unique records (no firm/lawyer caps).
    """
    async def _run(name: str, coro):
        try:
            result = await coro
            print(f"[premium] {name}: {len(result)} records")
            return result
        except Exception as exc:
            print(f"[premium] {name} failed: {exc}")
            import traceback
            traceback.print_exc()
            return []

    firm_lim = firm_target if not max_volume else 10000
    lawyer_lim = lawyer_target if not max_volume else 20000
    dir_lim = 25000 if max_volume else 8000
    osm_lim = 30000 if max_volume else 15000
    biz_lim = 25000 if max_volume else 10000
    khoj_lim = 20000 if max_volume else 8000

    chambers = await _run(
        "chambers",
        scrape_chambers_india(data_dir, firm_limit=firm_lim, lawyer_limit=lawyer_lim),
    )
    law_asia = await _run("law_asia", scrape_law_asia(data_dir, limit=3000 if max_volume else 1500))
    legal500 = await _run("legal500", scrape_legal500_india(data_dir, limit=5000 if max_volume else 2000))
    iflr = await _run("iflr1000", scrape_iflr1000_india(data_dir, limit=3000 if max_volume else 1200))
    bars = await _run("india_bars", scrape_india_bar_councils(data_dir, limit=8000 if max_volume else 2000))
    probono = await _run("probono", scrape_probono_advocates(data_dir, limit=8000 if max_volume else 1500))

    dirs: list[ProspectRecord] = []
    if include_directories:
        dirs = await _run("india_dirs", scrape_india_dirs(data_dir, limit=dir_lim))

    khoj: list[ProspectRecord] = []
    if include_directories:
        khoj = await _run("advocatekhoj", scrape_advocatekhoj(data_dir, limit=khoj_lim))

    justdial: list[ProspectRecord] = []
    sulekha: list[ProspectRecord] = []
    if include_biz_dirs:
        justdial = await _run("justdial", scrape_justdial_india(data_dir, limit=biz_lim))
        sulekha = await _run("sulekha", scrape_sulekha_india(data_dir, limit=biz_lim))

    osm_records: list[ProspectRecord] = []
    if include_osm:
        osm_records = await _run(
            "osm_in",
            scrape_osm(data_dir, limit=osm_lim, geography="in"),
        )

    all_records = (
        chambers + law_asia + legal500 + iflr + bars + probono
        + dirs + khoj + justdial + sulekha + osm_records
    )

    if max_volume:
        print(f"[premium] raw total before dedup: {len(all_records)}")
        return all_records

    firms, lawyers = _split_firms_lawyers(all_records)
    seen_f: set[str] = set()
    uniq_firms: list[ProspectRecord] = []
    for rec in firms:
        k = rec.full_name.lower()
        if k not in seen_f:
            seen_f.add(k)
            uniq_firms.append(rec)
    seen_l: set[str] = set()
    uniq_lawyers: list[ProspectRecord] = []
    for rec in lawyers:
        k = f"{rec.full_name.lower()}|{(rec.organisation or '').lower()}"
        if k not in seen_l:
            seen_l.add(k)
            uniq_lawyers.append(rec)

    print(
        f"[premium] firms {len(uniq_firms)}/{firm_target}, "
        f"lawyers {len(uniq_lawyers)}/{lawyer_target}"
    )
    return uniq_firms[:firm_target] + uniq_lawyers[:lawyer_target]
