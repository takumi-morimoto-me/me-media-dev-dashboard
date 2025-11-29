"""
ultelo スクレイパー

BaseScraperを継承し、asp_idとmedia_idをパラメータとして受け取る。
認証情報はasp_credentialsテーブルから取得。
"""
import re
from pathlib import Path
from typing import List, Dict, Any
from playwright.sync_api import Page

import sys
sys.path.append(str(Path(__file__).resolve().parent.parent.parent))

from core.base_scraper import BaseScraper, get_scraper_params


class UlteloScraper(BaseScraper):
    """ultelo用スクレイパー"""

    LOGIN_PAGE = 'https://ultelo.jp/'
    DAILY_REPORT_URL = 'https://ultelo.jp/view.php?type=date_log'
    MONTHLY_REPORT_URL = 'https://ultelo.jp/view.php?type=month_log'

    def login(self, page: Page) -> bool:
        """ulteloにログイン"""
        page.goto(self.LOGIN_PAGE, wait_until='domcontentloaded')
        self.human_delay(1000, 2000)

        # ログインフォーム（mail, pass）
        page.fill('input[name="mail"]', self.username)
        self.human_delay(300, 500)
        page.fill('input[name="pass"]', self.password)
        self.human_delay(300, 500)

        # ログインボタンをクリック
        page.click('input[type="submit"]')
        page.wait_for_timeout(3000)

        # ログイン確認（index.phpに遷移したか）
        if 'index.php' not in page.url and page.url != 'https://ultelo.jp/':
            return False

        # ログアウトリンクがあればログイン成功
        if page.locator('a[href*="logout"]').count() > 0:
            return True

        return True

    def scrape_daily(self, page: Page) -> List[Dict[str, Any]]:
        """日別レポートをスクレイピング"""
        records = []

        # 日別レポートページへ
        print("Navigating to daily report page...")
        page.goto(self.DAILY_REPORT_URL, wait_until='domcontentloaded')
        self.human_delay(2000, 3000)

        # 2番目のテーブルからデータを抽出
        print("Extracting data from table...")
        tables = page.locator('table').all()
        if len(tables) < 2:
            print("Data table not found")
            return records

        table = tables[1]  # 2番目のテーブル
        rows = table.locator('tr').all()

        for row in rows[1:]:  # ヘッダー行をスキップ
            try:
                cells = row.locator('td').all()
                if len(cells) < 8:
                    continue

                # 日付（例: 2025/11/29）
                date_text = cells[0].inner_text().strip()
                date_match = re.search(r'(\d{4})/(\d{1,2})/(\d{1,2})', date_text)
                if not date_match:
                    continue

                date_str = f"{date_match.group(1)}-{date_match.group(2).zfill(2)}-{date_match.group(3).zfill(2)}"

                # 報酬合計（最後のカラム）
                reward_text = cells[-1].inner_text().strip()
                amount = self._parse_amount(reward_text)

                records.append({
                    'date': date_str,
                    'amount': amount,
                })
                print(f"  {date_str}: {amount}円")

            except Exception as e:
                print(f"  Error parsing row: {e}")
                continue

        return records

    def scrape_monthly(self, page: Page) -> List[Dict[str, Any]]:
        """月別レポートをスクレイピング"""
        records = []

        # 月別レポートページへ
        print("Navigating to monthly report page...")
        page.goto(self.MONTHLY_REPORT_URL, wait_until='domcontentloaded')
        self.human_delay(2000, 3000)

        # 2番目のテーブルからデータを抽出
        print("Extracting data from table...")
        tables = page.locator('table').all()
        if len(tables) < 2:
            print("Data table not found")
            return records

        table = tables[1]  # 2番目のテーブル
        rows = table.locator('tr').all()

        for row in rows[1:]:  # ヘッダー行をスキップ
            try:
                cells = row.locator('td').all()
                if len(cells) < 8:
                    continue

                # 年月（例: 2025年11月）
                month_text = cells[0].inner_text().strip()
                month_match = re.search(r'(\d{4})年(\d{1,2})月', month_text)
                if not month_match:
                    continue

                date_str = f"{month_match.group(1)}-{month_match.group(2).zfill(2)}-01"

                # 報酬合計（最後のカラム）
                reward_text = cells[-1].inner_text().strip()
                amount = self._parse_amount(reward_text)

                records.append({
                    'date': date_str,
                    'amount': amount,
                })
                print(f"  {month_text}: {amount}円")

            except Exception as e:
                print(f"  Error parsing row: {e}")
                continue

        return records

    def _parse_amount(self, text: str) -> int:
        """金額文字列をパース（例: 9,100円 → 9100）"""
        if not text:
            return 0
        # 円、カンマを除去
        cleaned = re.sub(r'[円,\s]', '', text)
        if not cleaned or cleaned == '-':
            return 0
        try:
            return int(cleaned)
        except ValueError:
            return 0


def run_daily(asp_id: str = None, media_id: str = None, headless: bool = True):
    """
    日次スクレイピングを実行

    Args:
        asp_id: ASP ID（省略時は名前から検索）
        media_id: メディアID（省略時は名前から検索）
        headless: ヘッドレスモード
    """
    if not asp_id or not media_id:
        asp_id, media_id = get_scraper_params("ultelo", "ReRe")

    scraper = UlteloScraper(asp_id, media_id, headless=headless)
    return scraper.run_daily()


def run_monthly(asp_id: str = None, media_id: str = None, headless: bool = True):
    """
    月次スクレイピングを実行

    Args:
        asp_id: ASP ID（省略時は名前から検索）
        media_id: メディアID（省略時は名前から検索）
        headless: ヘッドレスモード
    """
    if not asp_id or not media_id:
        asp_id, media_id = get_scraper_params("ultelo", "ReRe")

    scraper = UlteloScraper(asp_id, media_id, headless=headless)
    return scraper.run_monthly()


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="ultelo スクレイパー")
    parser.add_argument('--asp-id', help='ASP ID')
    parser.add_argument('--media-id', help='Media ID')
    parser.add_argument('--asp-name', default='ultelo', help='ASP名')
    parser.add_argument('--media-name', default='ReRe', help='メディア名')
    parser.add_argument('--daily', action='store_true', help='日次データを取得')
    parser.add_argument('--monthly', action='store_true', help='月次データを取得')
    parser.add_argument('--no-headless', action='store_true', help='ブラウザを表示')

    args = parser.parse_args()

    # IDが指定されていない場合は名前から取得
    asp_id = args.asp_id
    media_id = args.media_id

    if not asp_id or not media_id:
        asp_id, media_id = get_scraper_params(args.asp_name, args.media_name)
        print(f"Resolved: ASP={asp_id}, Media={media_id}")

    headless = not args.no_headless

    if args.monthly:
        result = run_monthly(asp_id, media_id, headless)
    else:
        result = run_daily(asp_id, media_id, headless)

    print(f"Result: {result}")
