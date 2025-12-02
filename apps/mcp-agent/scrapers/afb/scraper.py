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
    DAILY_REPORT_URL = 'https://www.afi-b.com/pa/report/?r=daily#tab_btn_top'

    def login(self, page: Page) -> bool:
        """ログイン処理"""
        print(f"Navigating to {self.LOGIN_URL}...")
        page.goto(self.LOGIN_URL, timeout=60000)
        page.wait_for_timeout(3000)

        print("Filling partner login form...")
        # パートナーログインフォームを明示的に指定
        page.fill("#formPartnerId", self.username)
        page.fill("#formPartnerPassword", self.password)

        print("Clicking login button...")
        # パートナーフォームの送信ボタンをクリック
        page.locator("form:has(#formPartnerId) button[type='submit']").click()
        page.wait_for_timeout(8000)

        # ポップアップを閉じる
        try:
            page.keyboard.press("Escape")
            page.wait_for_timeout(1000)
        except:
            pass

        # ログイン成功判定
        print("Checking login success...")
        if page.locator("text=ログアウト").count() > 0 or page.locator("text=マイページ").count() > 0 or page.url != self.LOGIN_URL:
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

        # Find the report data table (contains "年月日" header and many rows)
        all_tables = page.locator("table").all()
        report_table = None

        for table in all_tables:
            rows = table.locator("tr").all()
            if len(rows) > 30:  # Data table has many rows
                html = table.inner_html()
                if '年月日' in html:
                    report_table = table
                    print(f"Found report table with {len(rows)} rows")
                    break

        if not report_table:
            print("Report table not found!")
            return records

        rows = report_table.locator("tr").all()
        print(f"Found {len(rows)} table rows in report table")

        for row in rows:
            cells = row.locator("td").all()
            if len(cells) < 8:
                continue

            row_text = row.inner_text()

            # Only process "合計" rows (skip TEL-only rows)
            if '合計' not in row_text:
                continue

            date_text = cells[0].inner_text().strip()

            # Skip header or summary rows
            if '合計' in date_text or date_text == '-':
                continue

            # 日付の解析
            match = re.match(r'(\d{4})[年/-](\d{1,2})[月/-](\d{1,2})', date_text)
            if not match:
                continue

            y, m, d = match.groups()
            date_str = f"{y}-{int(m):02d}-{int(d):02d}"

            # Extract data from cells
            # Structure: 年月日, 曜日, Dev(合計/TEL), 表示回数, Click数, Click報酬, CTR, 発生数, 発生報酬, ...
            try:
                clicks = self._parse_amount(cells[4].inner_text())  # Click数
                acquisitions = self._parse_amount(cells[7].inner_text())  # 発生数
                amount = self._parse_amount(cells[8].inner_text())  # 発生報酬

                records.append({
                    'date': date_str,
                    'amount': amount,  # Required by BaseScraper
                    'clicks': clicks,
                    'acquisitions': acquisitions,
                })
            except (IndexError, ValueError) as e:
                print(f"Error parsing row for {date_str}: {e}")
                continue

        return records

    def scrape_daily(self, page: Page) -> List[Dict[str, Any]]:
        """日次データのスクレイピング"""
        print("Navigating to daily report...")
        page.goto(self.DAILY_REPORT_URL, timeout=60000, wait_until="domcontentloaded")
        page.wait_for_timeout(5000)

        # Select 30 day span radio button
        print("Setting 30 day span...")
        try:
            thirty_day_radio = page.locator("form[action*='r=daily'] input[name='span'][value='30d']").first
            if thirty_day_radio.count() > 0:
                thirty_day_radio.check()
                print("Selected 30 day span")
            page.wait_for_timeout(1000)
        except Exception as e:
            print(f"Span selection failed: {e}")

        # Click the send button (type='image' with name='send')
        print("Clicking send button...")
        try:
            send_btn = page.locator("form[action*='r=daily'] input[name='send'][type='image']").first
            if send_btn.is_visible():
                send_btn.click()
            else:
                # Fallback: JavaScript click
                page.evaluate("""
                    const forms = document.querySelectorAll('form[action*="r=daily"]');
                    for (const form of forms) {
                        const sendBtn = form.querySelector('input[name="send"]');
                        if (sendBtn) {
                            sendBtn.click();
                            break;
                        }
                    }
                """)
            page.wait_for_timeout(10000)
        except Exception as e:
            print(f"Send button click failed: {e}")

        print(f"URL after submit: {page.url}")

        # スクロール to show report
        page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
        page.wait_for_timeout(2000)

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
