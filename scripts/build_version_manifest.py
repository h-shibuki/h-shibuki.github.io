#!/usr/bin/env python3
from __future__ import annotations

import json
import subprocess
from collections import OrderedDict
from datetime import datetime
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parent.parent
INDEX_FILE = ROOT / 'index.html'
OUTPUT_FILE = ROOT / 'version-manifest.json'
TARGET_CLASSES = {'resource-card', 'world-card', 'plain-card'}
SKIP_HREFS = {'#', './gm.html', 'gm.html'}
SKIP_SCHEMES = {'http', 'https', 'mailto', 'javascript'}
DISPLAY_TZ = ZoneInfo('Asia/Tokyo')


class CardHrefParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.hrefs: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag != 'a':
            return
        attr_map = dict(attrs)
        href = (attr_map.get('href') or '').strip()
        if not href or href in SKIP_HREFS:
            return
        classes = set((attr_map.get('class') or '').split())
        if not (TARGET_CLASSES & classes):
            return
        normalized = normalize_href(href)
        if normalized and normalized not in self.hrefs:
            self.hrefs.append(normalized)


def normalize_href(href: str) -> str:
    split = urlsplit(href)
    if split.scheme in SKIP_SCHEMES:
        return ''

    clean_path = split.path.strip()
    if not clean_path:
        return ''

    return clean_path if clean_path.startswith('./') else f'./{clean_path}'


def href_to_repo_path(href: str) -> Path:
    return ROOT / href.removeprefix('./')


def read_card_hrefs() -> list[str]:
    parser = CardHrefParser()
    parser.feed(INDEX_FILE.read_text(encoding='utf-8'))
    return parser.hrefs


def latest_commit_iso(path: Path) -> str | None:
    result = subprocess.run(
        ['git', 'log', '-1', '--format=%cI', '--', str(path.relative_to(ROOT))],
        cwd=ROOT,
        text=True,
        capture_output=True,
        check=False,
    )
    value = result.stdout.strip()
    return value or None


def iso_to_display(iso_text: str) -> str:
    dt = datetime.fromisoformat(iso_text.replace('Z', '+00:00')).astimezone(DISPLAY_TZ)
    return dt.strftime('%Y/%m/%d %H:%M:%S')


def build_manifest() -> dict[str, object]:
    pages: OrderedDict[str, dict[str, str]] = OrderedDict()

    for href in read_card_hrefs():
        target_path = href_to_repo_path(href)
        if not target_path.exists():
            continue

        iso = latest_commit_iso(target_path)
        if not iso:
            continue

        pages[href] = {
            'path': str(target_path.relative_to(ROOT)),
            'iso': iso,
            'display': iso_to_display(iso),
        }

    now = datetime.now(DISPLAY_TZ).strftime('%Y/%m/%d %H:%M:%S')
    return {
        'generatedAt': now,
        'timezone': 'Asia/Tokyo',
        'pages': pages,
    }


def main() -> None:
    manifest = build_manifest()
    OUTPUT_FILE.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + '\n',
        encoding='utf-8',
    )


if __name__ == '__main__':
    main()
