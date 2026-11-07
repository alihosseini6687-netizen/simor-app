#!/usr/bin/env python3
"""SIMAB core-app read-only release gate (excludes unfinished Mango AI generation).

Offline checks validate every active home game destination and local HTML assets.
Live checks hit public GitHub Pages and the Edge's *read-only* catalog/health routes.
No Telegram accounts, wallets, game sessions, payments or database rows are changed.
"""
import argparse
from html.parser import HTMLParser
from pathlib import Path
import posixpath
import re
import urllib.parse
import urllib.request
import json

ROOT = Path(__file__).resolve().parents[1]
BASE = "https://alihosseini6687-netizen.github.io/simor-app/"
EDGE = "https://pwjlyryrrgbaprfnrieq.supabase.co/functions/v1/simab-central-quests"

EXPECTED_GAMES = {
    1: "games/poker/index.html",
    2: "games/slot/index.html",
    3: "games/room/index.html?game=backgammon",
    4: "games/room/index.html?game=hokm",
    5: "games/blackjack/index.html",
    6: "games/room/index.html?game=sevens",
    7: "games/room/index.html?game=truth",
    8: "games/room/index.html?game=mill",
    9: "games/room/index.html?game=bingo",
    10: "games/room/index.html?game=ludo",
    11: "games/room/index.html?game=snakes",
}

CORE_PAGES = [
    "index.html",
    "games/poker/index.html", "games/poker/friends.html",
    "games/slot/index.html", "games/blackjack/index.html",
    "games/room/index.html", "games/wheel/index.html",
    "games/tap/index.html", "quests/index.html",
    "wallet/index.html", "streak/index.html",
    "swap/index.html", "admin/index.html",
]


class AssetParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.assets = []

    def handle_starttag(self, tag, attrs):
        d = dict(attrs)
        if tag == "script" and d.get("src"):
            self.assets.append(d["src"])
        if tag == "link" and d.get("href") and d.get("rel") in ("stylesheet", "icon", "manifest"):
            self.assets.append(d["href"])


def relative_asset(page, link):
    u = urllib.parse.urlsplit(link)
    if u.scheme or u.netloc or not u.path or u.path.startswith("data:"):
        return None
    if u.path.startswith("/"):
        path = u.path.removeprefix("/simor-app/").lstrip("/")
    else:
        path = posixpath.normpath(posixpath.join(posixpath.dirname(page), u.path))
    if path.startswith("../") or path == "..":
        raise AssertionError(f"Asset escapes app directory: {page}: {link}")
    return path


def offline():
    homepage = (ROOT / "index.html").read_text(encoding="utf-8")
    assert "const gamesDatabase = [" in homepage, "Game catalog not found"
    catalog = homepage.split("const gamesDatabase = [", 1)[1].split("];", 1)[0]
    matches = re.findall(r"\{\s*id:\s*(\d+),[^\n]*?url:\s*'([^']+)',\s*active:\s*(true|false)", catalog)
    active = {int(k): url for k, url, status in matches if status == "true"}
    assert active == EXPECTED_GAMES, f"Active game paths changed: {active!r}"
    assert len(active) == len(set(active)), "Duplicate game IDs"
    for game_id, url in active.items():
        parts = urllib.parse.urlsplit(url)
        target = ROOT / parts.path
        assert target.is_file(), f"Game {game_id} is linked to a missing page: {url}"
        if parts.query:
            query = urllib.parse.parse_qs(parts.query)
            assert list(query) == ["game"] and len(query["game"]) == 1
    count = 0
    for page in CORE_PAGES:
        file = ROOT / page
        assert file.is_file(), f"Missing core page: {page}"
        text = file.read_text(encoding="utf-8")
        assert "<html" in text.lower(), f"Invalid HTML entry: {page}"
        parser = AssetParser()
        parser.feed(text)
        for href in parser.assets:
            asset = relative_asset(page, href)
            if asset is None:
                continue
            assert (ROOT / asset).is_file(), f"Missing asset referenced by {page}: {href}"
            count += 1
    print(f"OFFLINE PASS: {len(active)} active games, {len(CORE_PAGES)} core pages, {count} asset references.")


def get_text(url):
    req = urllib.request.Request(url, headers={"User-Agent": "SIMAB-core-readonly-release-gate/1.0"})
    with urllib.request.urlopen(req, timeout=25) as res:
        assert res.status == 200, f"HTTP {res.status} {url}"
        return res.read(700000).decode("utf-8", errors="replace")


def live():
    for page in CORE_PAGES:
        html = get_text(urllib.parse.urljoin(BASE, page))
        assert "<html" in html.lower(), f"Live site does not serve HTML: {page}"
    health = json.loads(get_text(EDGE + "?health=1"))
    assert health.get("ok") is True, "Edge health is not OK"
    assert health.get("botMatchesExpected") is True, "Wrong Telegram bot identity"
    # This is a *read-only* public catalog. Never fake a task claim on production.
    catalog = json.loads(get_text(EDGE))
    assert isinstance(catalog.get("rewardsEnabled"), bool), "Task availability missing"
    quests = catalog.get("quests")
    assert isinstance(quests, list), "Public tasks response malformed"
    assert all(isinstance(q, dict) and q.get("id") and q.get("title") for q in quests)
    assert len({q["id"] for q in quests}) == len(quests), "Duplicate public task IDs"
    print(f"LIVE PASS: {len(CORE_PAGES)} public pages, Edge health, public task catalog ({len(quests)} tasks; rewards enabled={catalog['rewardsEnabled']}).")


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--live", action="store_true", help="Verify currently published pages and read-only Edge endpoints")
    args = p.parse_args()
    offline()
    if args.live:
        live()
