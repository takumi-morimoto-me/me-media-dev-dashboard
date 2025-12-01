"""
afb（アフィリエイトB）スクレイパー（新形式）

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


class AfbScraper(BaseScraper):
    """afb スクレイパー"""

    LOGIN_URL = 'https://www.afi-b.com/'
    DAILY_REPORT_URL = 'https://www.afi-b.com/pa/report/?r=daily'

    def login(self, page: Page) -> bool:
        """ログイン処理"""
        print(f"Navigating to {self.LOGIN_URL}...")
        page.goto(self.LOGIN_URL)
        page.wait_for_timeout(2000)

        print("Filling login form...")
        page.fill("input[type='text']", self.username)
        page.fill("input[type='password']", self.password)

        print("Clicking login button...")
        page.click("input[type='submit'], button[type='submit']")
        page.wait_for_timeout(5000)

        # ポップアップを閉じる
        page.keyboard.press("Escape")
        page.wait_for_timeout(1000)

        # ログイン成功判定
        if page.locator("text=ログアウト").count() > 0 or page.locator("text=マイページ").count() > 0:
            return True

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
        page.goto(self.DAILY_REPORT_URL)
        page.wait_for_timeout(3000)

        # 日別タブをクリック
        try:
            page.click("a[href*='#tab_btn_top'][title='日別レポート'], #tab_btn_top a:has-text('日別')")
            page.wait_for_timeout(2000)
        except:
            print("Daily tab click failed, continuing...")

        # レポート表示ボタンをクリック
        try:
            page.click("input[data-testid='daily-display-report'], input.send_report:visible")
            page.wait_for_timeout(5000)
        except:
            print("Display report button click failed, continuing...")

        # スクロール
        page.evaluate("window.scrollBy(0, 500)")
        page.wait_for_timeout(1000)

        print("Extracting data from table...")
        records = self._extract_table_data(page)

        return records

    def scrape_monthly(self, page: Page) -> List[Dict[str, Any]]:
        """月次データのスクレイピング"""
        raise NotImplementedError("Monthly scraping not yet implemented for afb")


if __name__ == "__main__":
    import argparse
    from core.base_scraper import get_scraper_params

    parser = argparse.ArgumentParser(description="afb Scraper")
    parser.add_argument('--asp', default='afb（ビギナーズ・OJ）', help='ASP name')
    parser.add_argument('--media', default='ReRe', help='Media name')
    parser.add_argument('--daily', action='store_true', help='Run daily scraper')
    parser.add_argument('--monthly', action='store_true', help='Run monthly scraper')
    parser.add_argument('--no-headless', action='store_true', help='Show browser')
    args = parser.parse_args()

    asp_id, media_id = get_scraper_params(args.asp, args.media)
    scraper = AfbScraper(
        asp_id=asp_id,
        media_id=media_id,
        headless=not args.no_headless
    )

    if args.monthly:
        result = scraper.run_monthly()
    else:
        result = scraper.run_daily()

    print(f"Result: {result}")
