"""
felmat スクレイパー（新形式）

BaseScraper を継承し、asp_id と media_id をパラメータとして受け取る。
認証情報は asp_credentials テーブルから取得。
"""
import re
import csv
import time
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any
from playwright.sync_api import Page

import sys
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))
from core.base_scraper import BaseScraper


class FelmatScraper(BaseScraper):
    """felmat スクレイパー"""

    LOGIN_URL = 'https://www.felmat.net/publisher/login'

    def login(self, page: Page) -> bool:
        """ログイン処理"""
        print(f"Navigating to {self.LOGIN_URL}...")
        page.goto(self.LOGIN_URL)
        page.wait_for_timeout(3000)

        print("Filling login form...")
        page.fill("input[name='p_username']", self.username)
        page.fill("input[name='p_password']", self.password)
        page.click("button[type='submit']")
        page.wait_for_timeout(5000)

        # ログイン成功判定
        if page.locator("text=ログアウト").count() > 0 or page.locator("text=レポート").count() > 0:
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

    def _navigate_to_report(self, page: Page, report_type: str) -> None:
        """レポートページへナビゲート（日別/月別）"""
        print(f"Navigating to {report_type} report...")

        # ナビゲーションのレポートメニューをホバーしてドロップダウンを表示
        # ヘッダーナビゲーション内のレポートリンクを探す
        report_menu = page.locator("nav a:has-text('レポート'), header a:has-text('レポート'), .navbar a:has-text('レポート')").first
        if report_menu.count() == 0:
            # フォールバック: 可視状態のレポートリンクを探す
            report_menu = page.locator("a:has-text('レポート')").first

        report_menu.hover()
        page.wait_for_timeout(1000)

        # ドロップダウンメニューから日別/月別をクリック
        target_link = page.locator(f"a:has-text('{report_type}')").first
        target_link.click()
        page.wait_for_timeout(3000)

    def scrape_daily(self, page: Page) -> List[Dict[str, Any]]:
        """日次データのスクレイピング"""
        self._navigate_to_report(page, "日別")

        print("Extracting data from table...")
        records = self._extract_table_data(page)

        return records

    def scrape_monthly(self, page: Page) -> List[Dict[str, Any]]:
        """月次データのスクレイピング（CSV経由）"""
        self._navigate_to_report(page, "月別")

        # ダウンロードディレクトリを作成
        download_dir = self.create_download_dir("felmat_monthly")

        # CSVダウンロードボタンをクリック
        print("Downloading CSV...")
        with page.expect_download() as download_info:
            page.click("text=上記条件でCSVダウンロード")

        download = download_info.value
        csv_path = download_dir / "monthly_report.csv"
        download.save_as(csv_path)
        print(f"CSV saved to {csv_path}")

        # CSVを解析
        records = self._parse_monthly_csv(csv_path)

        return records

    def _parse_monthly_csv(self, csv_path: Path) -> List[Dict[str, Any]]:
        """月次CSVを解析"""
        records = []

        # Shift-JISで読み込み（日本語CSVの場合）
        encodings = ['utf-8', 'shift_jis', 'cp932']
        content = None

        for encoding in encodings:
            try:
                with open(csv_path, 'r', encoding=encoding) as f:
                    content = f.read()
                break
            except UnicodeDecodeError:
                continue

        if not content:
            print("Failed to decode CSV file")
            return records

        # CSVを解析
        lines = content.strip().split('\n')
        if len(lines) < 2:
            print("CSV file is empty or has no data")
            return records

        # ヘッダー行を取得
        reader = csv.reader(lines)
        headers = next(reader)
        print(f"CSV Headers: {headers}")

        # カラムインデックスを特定
        date_col = None
        amount_col = None

        for i, h in enumerate(headers):
            if '年月' in h:
                date_col = i
            # 発生報酬（税抜）を優先的に使用
            if '発生報酬' in h and '税抜' in h:
                amount_col = i
            elif '承認報酬' in h and '税抜' in h and amount_col is None:
                amount_col = i
            elif '報酬合計' in h and '税抜' in h and amount_col is None:
                amount_col = i

        if date_col is None or amount_col is None:
            print(f"Could not find required columns. date_col={date_col}, amount_col={amount_col}")
            return records

        print(f"Using columns: date={headers[date_col]}, amount={headers[amount_col]}")

        # データ行を処理
        for row in reader:
            if len(row) <= max(date_col, amount_col):
                continue

            date_text = row[date_col].strip()
            amount_text = row[amount_col].strip()

            # 年月を解析 (2025年01月 or 2025/01 形式)
            match = re.match(r'(\d{4})[年/](\d{1,2})', date_text)
            if match:
                y, m = match.groups()
                date_str = f"{y}-{int(m):02d}-01"
                amount = self._parse_amount(amount_text)

                records.append({
                    'date': date_str,
                    'amount': amount,
                })
                print(f"  {date_str}: {amount}")

        print(f"Parsed {len(records)} monthly records")
        return records


if __name__ == "__main__":
    import argparse
    from core.base_scraper import get_scraper_params

    parser = argparse.ArgumentParser(description="felmat Scraper")
    parser.add_argument('--asp', default='felmat', help='ASP name')
    parser.add_argument('--media', default='ReRe', help='Media name')
    parser.add_argument('--daily', action='store_true', help='Run daily scraper')
    parser.add_argument('--monthly', action='store_true', help='Run monthly scraper')
    parser.add_argument('--no-headless', action='store_true', help='Show browser')
    args = parser.parse_args()

    asp_id, media_id = get_scraper_params(args.asp, args.media)
    scraper = FelmatScraper(
        asp_id=asp_id,
        media_id=media_id,
        headless=not args.no_headless
    )

    if args.monthly:
        result = scraper.run_monthly()
    else:
        result = scraper.run_daily()

    print(f"Result: {result}")
