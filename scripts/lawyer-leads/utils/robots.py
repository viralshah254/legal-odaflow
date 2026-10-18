"""Simple robots.txt checker."""

from __future__ import annotations

import asyncio
from urllib.parse import urljoin, urlparse
from urllib.robotparser import RobotFileParser

import aiohttp

_cache: dict[str, RobotFileParser | None] = {}


async def allowed(url: str, user_agent: str = "UmbrellaLawyerProspectBot/1.0") -> bool:
    parsed = urlparse(url)
    base = f"{parsed.scheme}://{parsed.netloc}"
    if base in _cache:
        rp = _cache[base]
        return rp is None or rp.can_fetch(user_agent, url)

    robots_url = urljoin(base, "/robots.txt")
    rp = RobotFileParser()
    rp.set_url(robots_url)
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(
                robots_url,
                timeout=aiohttp.ClientTimeout(total=10),
                headers={"User-Agent": user_agent},
            ) as resp:
                if resp.status != 200:
                    _cache[base] = None
                    return True
                text = await resp.text()
        rp.parse(text.splitlines())
        _cache[base] = rp
        return rp.can_fetch(user_agent, url)
    except Exception:
        _cache[base] = None
        return True
