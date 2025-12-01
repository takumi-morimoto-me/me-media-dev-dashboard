"""
affitown スクレイパー（新形式）

BaseScraper を継承し、asp_id と media_id をパラメータとして受け取る。
認証情報は asp_credentials テーブルから取得。
"""
import re
import csv
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any
from playwright.sync_api import Page

import sys
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))
from core.base_scraper import BaseScraper


class AffitownScraper(BaseScraper):
    """affitown スクレイパー"""

    LOGIN_URL = 'https://affitown.jp/'
    MONTHLY_REPORT_URL = 'https://affitown.jp/partneradmin/report/monthly/list'

    def login(self, page: Page) -> bool:
        """ログイン処理"""
        print(f"Navigating to {self.LOGIN_URL}...")
        page.goto(self.LOGIN_URL)
        page.wait_for_timeout(2000)

        print("Filling login form...")
        page.fill("form[action='/partner/login/confirm'] input[name='loginId']", self.username)
        page.fill("form[action='/partner/login/confirm'] input[name='password']", self.password)
        page.click("form[action='/partner/login/confirm'] input[type='submit']")
        page.wait_for_timeout(5000)

        # ログイン成功判定
        if "login" in page.url.lower():
            return False

        print("Logged in successfully")
        return True

    def _parse_amount(self, text: str) -> int:
        """金額文字列を整数に変換"""
        cleaned = re.sub(r'[^\d]', '', str(text))
        return int(cleaned) if cleaned else 0

    def _parse_date(self, text: str, year: str = None) -> str:
        """日付文字列をYYYY-MM-DD形式に変換"""
        # "2025年11月06日" or "2025/11/06" -> "2025-11-06"
        match = re.match(r'(\d{4})[年/](\d{1,2})[月/](\d{1,2})', text)
        if match:
            y, m, d = match.groups()
            return f"{y}-{int(m):02d}-{int(d):02d}"

        # "11月06日" -> "2025-11-06" (年がない場合)
        match = re.match(r'(\d{1,2})月(\d{1,2})日', text)
        if match and year:
            m, d = match.groups()
            return f"{year}-{int(m):02d}-{int(d):02d}"

        return None

    def _parse_csv_file(self, filepath: Path) -> List[Dict[str, Any]]:
        """CSVファイルをパースしてレコードリストを返す"""
        records = []

        # ファイル名から年を取得 (daily_2025-11.csv -> 2025)
        filename = filepath.stem
        year_match = re.search(r'(\d{4})', filename)
        year = year_match.group(1) if year_match else None

        with open(filepath, 'r', encoding='utf-8-sig') as f:
            reader = csv.reader(f)
            headers = next(reader, None)

            if not headers:
                return records

            # ヘッダーから報酬金額合計のインデックスを見つける
            amount_idx = None
            date_idx = None
            for i, h in enumerate(headers):
                if '報酬金額合計' in h or '報酬合計' in h:
                    amount_idx = i
                if '日付' in h or '日' in h:
                    date_idx = i

            # 最初のカラムが日付の場合
            if date_idx is None:
                date_idx = 0
            # 最後のカラムが金額の場合
            if amount_idx is None:
                amount_idx = len(headers) - 1

            print(f"    Headers: {headers}")
            print(f"    Date column: {date_idx}, Amount column: {amount_idx}, Year: {year}")

            for row in reader:
                if len(row) <= max(date_idx, amount_idx):
                    continue

                date_text = row[date_idx]
                amount_text = row[amount_idx]

                # 合計行をスキップ
                if '合計' in date_text:
                    continue

                date = self._parse_date(date_text, year)
                amount = self._parse_amount(amount_text)

                if date and amount > 0:
                    records.append({
                        'date': date,
                        'amount': amount
                    })

        return records

    def _download_daily_csv(self, page: Page, year_month: str, download_dir: Path) -> Path:
        """指定月の日次CSVをダウンロード"""
        # 時系列レポートページに移動
        page.goto(self.MONTHLY_REPORT_URL)
        page.wait_for_timeout(3000)

        # 指定月のフォームを見つけてsubmit
        forms = page.query_selector_all("form[action='/partneradmin/report/daily/list']")
        form_found = False

        for form in forms:
            year_month_input = form.query_selector("input[name='searchYearMonth']")
            if year_month_input:
                val = year_month_input.get_attribute("value")
                if val == year_month:
                    print(f"  Navigating to daily report for {year_month}...")
                    page.evaluate("form => form.submit()", form)
                    page.wait_for_timeout(3000)
                    form_found = True
                    break

        if not form_found:
            print(f"  Form not found for {year_month}")
            return None

        # CSVダウンロードボタンをクリック
        csv_button = page.query_selector("a:has-text('CSVダウンロード'), button:has-text('CSVダウンロード')")
        if not csv_button:
            print(f"  CSV download button not found for {year_month}")
            return None

        # ダウンロードを待機
        with page.expect_download() as download_info:
            csv_button.click()

        download = download_info.value
        csv_path = download_dir / f"daily_{year_month}.csv"
        download.save_as(csv_path)
        print(f"  Downloaded: {csv_path}")

        return csv_path

    def scrape_daily(self, page: Page) -> List[Dict[str, Any]]:
        """日次データのスクレイピング"""
        download_dir = self.create_download_dir("affitown_daily")
        all_records = []

        # 2025年のデータを取得（1月〜現在月）
        current_month = datetime.now().month
        months = [f'2025-{m:02d}' for m in range(1, current_month + 1)]

        for month in months:
            csv_path = self._download_daily_csv(page, month, download_dir)
            if csv_path and csv_path.exists():
                records = self._parse_csv_file(csv_path)
                all_records.extend(records)
                print(f"    Found {len(records)} records for {month}")

        return all_records

    def scrape_monthly(self, page: Page) -> List[Dict[str, Any]]:
        """月次データのスクレイピング"""
        records = []

        print("Navigating to Monthly Report...")
        page.goto(self.MONTHLY_REPORT_URL)
        page.wait_for_timeout(3000)

        # テーブルからデータを抽出
        rows = page.locator("table tbody tr").all()
        print(f"Found {len(rows)} rows in table")

        for row in rows:
            cells = row.locator("td").all()
            if len(cells) < 2:
                continue

            # 月と金額を取得（実際のテーブル構造に合わせて調整が必要）
            month_text = cells[0].inner_text().strip()
            amount_text = cells[-1].inner_text().strip()  # 最後のカラムが金額と仮定

            # 合計行をスキップ
            if '合計' in month_text:
                continue

            # 月の解析 (2025-11 形式)
            match = re.match(r'(\d{4})[年/-](\d{1,2})', month_text)
            if match:
                year, month = match.groups()
                date_str = f"{year}-{int(month):02d}-01"
                amount = self._parse_amount(amount_text)

                if amount > 0:
                    records.append({
                        'date': date_str,
                        'amount': amount,
                    })
                    print(f"  {date_str}: ¥{amount:,}")

        return records


if __name__ == "__main__":
    import argparse
    from core.base_scraper import get_scraper_params

    parser = argparse.ArgumentParser(description="affitown Scraper")
    parser.add_argument('--asp', default='affitown(SIM通信・おいくら・高マガ・SIMチェンジ・ビギ）', help='ASP name')
    parser.add_argument('--media', default='ReRe', help='Media name')
    parser.add_argument('--daily', action='store_true', help='Run daily scraper')
    parser.add_argument('--monthly', action='store_true', help='Run monthly scraper')
    parser.add_argument('--no-headless', action='store_true', help='Show browser')
    args = parser.parse_args()

    asp_id, media_id = get_scraper_params(args.asp, args.media)
    scraper = AffitownScraper(
        asp_id=asp_id,
        media_id=media_id,
        headless=not args.no_headless
    )

    if args.monthly:
        result = scraper.run_monthly()
    else:
        result = scraper.run_daily()

    print(f"Result: {result}")
