"""
CircuitX スクレイパー（新形式）

BaseScraper を継承し、asp_id と media_id をパラメータとして受け取る。
認証情報は asp_credentials テーブルから取得。
"""
import re
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any
from playwright.sync_api import Page

import sys
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))
from core.base_scraper import BaseScraper


class CircuitxScraper(BaseScraper):
    """CircuitX スクレイパー"""

    LOGIN_URL = 'https://x-dashboard.cir.io/'

    def login(self, page: Page) -> bool:
        """ログイン処理"""
        print(f"Navigating to {self.LOGIN_URL}...")
        page.goto(self.LOGIN_URL, timeout=60000)
        page.wait_for_timeout(3000)

        print("Filling login form...")
        # 正確なセレクタを使用
        page.fill("#general_user_mail", self.username)
        page.fill("#general_user_password", self.password)

        print("Clicking login button...")
        page.click("input[name='commit']")
        page.wait_for_timeout(8000)

        # ログイン成功判定
        print("Checking login success...")
        if "login" not in page.url.lower() or page.locator("text=レポート").count() > 0 or page.locator("text=ログアウト").count() > 0:
            print("Login successful")
            return True

        print("Login failed")
        return False

    def _parse_amount(self, text: str) -> int:
        """金額文字列を整数に変換"""
        cleaned = re.sub(r'[^\d]', '', str(text))
        return int(cleaned) if cleaned else 0

    def _extract_table_data(self, page: Page) -> List[Dict[str, Any]]:
        """テーブルからデータを抽出"""
        records = []
        current_year = datetime.now().year

        rows = page.locator("table tbody tr").all()
        print(f"Found {len(rows)} table rows")

        for row in rows:
            cells = row.locator("td").all()
            if len(cells) < 2:
                continue

            date_text = cells[0].inner_text().strip()

            if '合計' in date_text or '平均' in date_text:
                continue

            # 日付の解析（複数フォーマット対応）- まず日付かどうか判定
            date_str = None

            # パターン1: 2025/12/01(月) or 2024年11月01日 or 2024-11-01
            match = re.match(r'(\d{4})[年/-](\d{1,2})[月/-](\d{1,2})', date_text)
            if match:
                y, m, d = match.groups()
                date_str = f"{y}-{int(m):02d}-{int(d):02d}"

            # パターン2: 11月01日 or 11/01 (年なし)
            if not date_str:
                match = re.match(r'(\d{1,2})[月/](\d{1,2})', date_text)
                if match:
                    m, d = match.groups()
                    date_str = f"{current_year}-{int(m):02d}-{int(d):02d}"

            # 日付行でない場合はスキップ（メディア名などの集計行）
            if not date_str:
                continue

            # 金額は最後のカラム
            amount_text = cells[-1].inner_text().strip()
            amount = self._parse_amount(amount_text)

            print(f"    -> {date_str}: ¥{amount:,}")
            records.append({
                'date': date_str,
                'amount': amount,
            })

        return records

    def scrape_daily(self, page: Page) -> List[Dict[str, Any]]:
        """日次データのスクレイピング"""
        print("Navigating to reports...")
        page.click("a:has-text('レポート')")
        page.wait_for_timeout(3000)

        page.evaluate("window.scrollBy(0, 500)")
        page.wait_for_timeout(2000)

        page.click("span:has-text('日別'), a:has-text('日別'), button:has-text('日別')")
        page.wait_for_timeout(3000)

        print("Extracting data from table...")
        records = self._extract_table_data(page)

        return records

    def scrape_monthly(self, page: Page) -> List[Dict[str, Any]]:
        """月次データのスクレイピング"""
        raise NotImplementedError("Monthly scraping not yet implemented for CircuitX")


if __name__ == "__main__":
    import argparse
    from core.base_scraper import get_scraper_params

    parser = argparse.ArgumentParser(description="CircuitX Scraper")
    parser.add_argument('--asp', default='CircuitX（ビギナーズ）', help='ASP name')
    parser.add_argument('--media', default='ReRe', help='Media name')
    parser.add_argument('--daily', action='store_true', help='Run daily scraper')
    parser.add_argument('--monthly', action='store_true', help='Run monthly scraper')
    parser.add_argument('--no-headless', action='store_true', help='Show browser')
    args = parser.parse_args()

    asp_id, media_id = get_scraper_params(args.asp, args.media)
    scraper = CircuitxScraper(
        asp_id=asp_id,
        media_id=media_id,
        headless=not args.no_headless
    )

    if args.monthly:
        result = scraper.run_monthly()
    else:
        result = scraper.run_daily()

    print(f"Result: {result}")
