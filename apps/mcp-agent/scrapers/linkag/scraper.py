"""
Link-AG スクレイパー（新形式）

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


class LinkagScraper(BaseScraper):
    """Link-AG スクレイパー"""

    LOGIN_URL = 'https://link-ag.net/'

    def login(self, page: Page) -> bool:
        """ログイン処理"""
        print(f"Navigating to {self.LOGIN_URL}...")
        page.goto(self.LOGIN_URL, timeout=60000)
        page.wait_for_timeout(3000)

        print("Filling partner login form...")
        # パートナーログインフォームを明示的に指定（2つのフォームがある）
        partner_form = page.locator("form").filter(has=page.locator("input[name='partner_user[login_id]']")).first
        partner_form.locator("input[name='partner_user[login_id]']").fill(self.username)
        partner_form.locator("input[name='partner_user[password]']").fill(self.password)

        print("Clicking login button...")
        partner_form.locator("input[name='commit']").click()
        page.wait_for_timeout(8000)

        # ログイン成功判定
        print("Checking login success...")
        if page.locator("text=ログアウト").count() > 0 or page.locator("text=レポート").count() > 0 or "partner" in page.url:
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

        rows = page.locator("table tbody tr").all()
        print(f"Found {len(rows)} table rows")

        for row in rows:
            cells = row.locator("td").all()
            if len(cells) < 2:
                continue

            date_text = cells[0].inner_text().strip()
            amount_text = cells[-1].inner_text().strip()

            if '合計' in date_text:
                continue

            # 日付の解析
            match = re.match(r'(\d{4})[年/-](\d{1,2})[月/-](\d{1,2})', date_text)
            if match:
                y, m, d = match.groups()
                date_str = f"{y}-{int(m):02d}-{int(d):02d}"
                amount = self._parse_amount(amount_text)

                if amount > 0:
                    records.append({
                        'date': date_str,
                        'amount': amount,
                    })

        return records

    def scrape_daily(self, page: Page) -> List[Dict[str, Any]]:
        """日次データのスクレイピング"""
        print("Navigating to daily report...")
        page.hover("a:has-text('レポート'), li:has-text('レポート')")
        page.wait_for_timeout(1500)
        page.click("a:has-text('日別')")
        page.wait_for_timeout(5000)

        print("Extracting data from table...")
        records = self._extract_table_data(page)

        return records

    def scrape_monthly(self, page: Page) -> List[Dict[str, Any]]:
        """月次データのスクレイピング"""
        raise NotImplementedError("Monthly scraping not yet implemented for Link-AG")


if __name__ == "__main__":
    import argparse
    from core.base_scraper import get_scraper_params

    parser = argparse.ArgumentParser(description="Link-AG Scraper")
    parser.add_argument('--asp', default='Link-AG（ビギナーズ）', help='ASP name')
    parser.add_argument('--media', default='ReRe', help='Media name')
    parser.add_argument('--daily', action='store_true', help='Run daily scraper')
    parser.add_argument('--monthly', action='store_true', help='Run monthly scraper')
    parser.add_argument('--no-headless', action='store_true', help='Show browser')
    args = parser.parse_args()

    asp_id, media_id = get_scraper_params(args.asp, args.media)
    scraper = LinkagScraper(
        asp_id=asp_id,
        media_id=media_id,
        headless=not args.no_headless
    )

    if args.monthly:
        result = scraper.run_monthly()
    else:
        result = scraper.run_daily()

    print(f"Result: {result}")
