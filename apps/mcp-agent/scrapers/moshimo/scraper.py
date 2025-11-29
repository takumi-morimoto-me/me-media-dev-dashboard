"""
もしもアフィリエイト スクレイパー（リファクタリング版）

BaseScraperを継承し、asp_idとmedia_idをパラメータとして受け取る。
認証情報はasp_credentialsテーブルから取得。
"""
import csv
from pathlib import Path
from typing import List, Dict, Any
from playwright.sync_api import Page

import sys
sys.path.append(str(Path(__file__).resolve().parent.parent.parent))

from core.base_scraper import BaseScraper, get_scraper_params


class MoshimoScraper(BaseScraper):
    """もしもアフィリエイト用スクレイパー"""

    def login(self, page: Page) -> bool:
        """もしもアフィリエイトにログイン"""
        page.goto(self.login_url or 'https://af.moshimo.com/af/shop/index', wait_until='domcontentloaded')
        self.human_delay(1000, 2000)

        # フォーム入力
        page.fill('input[name="account"]', self.username)
        self.human_delay(300, 500)
        page.fill('input[name="password"]', self.password)
        self.human_delay(300, 500)

        # ログインボタン
        page.click('input[name="login"]')
        page.wait_for_timeout(5000)

        # ログイン確認
        if 'login' in page.url and 'shop/index' not in page.url:
            return False

        return True

    def scrape_daily(self, page: Page) -> List[Dict[str, Any]]:
        """日次レポートをスクレイピング"""
        records = []

        # 売上レポートへ移動
        print("Navigating to report page...")
        page.click('text=売上レポート')
        self.human_delay(2000, 3000)

        # 日次タブへ
        print("Clicking daily tab...")
        page.click('text=日次')
        self.human_delay(2000, 3000)

        # CSVダウンロード
        print("Downloading CSV...")
        download_dir = self.create_download_dir("moshimo_daily")

        with page.expect_download() as download_info:
            page.click('text=CSVダウンロード')

        download = download_info.value
        csv_path = download_dir / download.suggested_filename
        download.save_as(csv_path)
        print(f"CSV downloaded to: {csv_path}")

        # CSV解析（Shift_JISエンコーディング）
        with open(csv_path, 'r', encoding='shift_jis') as f:
            reader = csv.DictReader(f)
            print(f"CSV Headers: {reader.fieldnames}")

            for row in reader:
                # 成果発生日（2025年11月01日形式）または期間
                period = row.get('成果発生日', '') or row.get('期間', '')
                date_str = self.parse_date_jp(period)
                if not date_str:
                    continue

                # 報酬額
                amount = self.parse_yen(row.get('報酬額', '0'))

                records.append({
                    'date': date_str,
                    'amount': amount,
                })
                print(f"  {date_str}: {amount}円")

        return records

    def scrape_monthly(self, page: Page) -> List[Dict[str, Any]]:
        """月次レポートをスクレイピング"""
        records = []

        # 売上レポートへ移動
        print("Navigating to report page...")
        page.click('text=売上レポート')
        self.human_delay(2000, 3000)

        # 月次タブへ
        print("Clicking monthly tab...")
        page.click('text=月次')
        self.human_delay(2000, 3000)

        # CSVダウンロード
        print("Downloading CSV...")
        download_dir = self.create_download_dir("moshimo_monthly")

        with page.expect_download() as download_info:
            page.click('text=CSVダウンロード')

        download = download_info.value
        csv_path = download_dir / download.suggested_filename
        download.save_as(csv_path)
        print(f"CSV downloaded to: {csv_path}")

        # CSV解析（Shift_JISエンコーディング）
        with open(csv_path, 'r', encoding='shift_jis') as f:
            reader = csv.DictReader(f)
            print(f"CSV Headers: {reader.fieldnames}")

            for row in reader:
                # 期間（2025年01月形式）
                period = row.get('期間', '')
                date_str = self.parse_month_jp(period)
                if not date_str:
                    continue

                # 報酬額
                amount = self.parse_yen(row.get('報酬額', '0'))

                records.append({
                    'date': date_str,
                    'amount': amount,
                })
                print(f"  {period}: {amount}円")

        return records


def run_daily(asp_id: str = None, media_id: str = None, headless: bool = True):
    """
    日次スクレイピングを実行

    Args:
        asp_id: ASP ID（省略時は名前から検索）
        media_id: メディアID（省略時は名前から検索）
        headless: ヘッドレスモード
    """
    if not asp_id or not media_id:
        asp_id, media_id = get_scraper_params("もしも（ビギナーズ）", "ビギナーズ")

    scraper = MoshimoScraper(asp_id, media_id, headless=headless)
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
        asp_id, media_id = get_scraper_params("もしも（ビギナーズ）", "ビギナーズ")

    scraper = MoshimoScraper(asp_id, media_id, headless=headless)
    return scraper.run_monthly()


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="もしもアフィリエイト スクレイパー")
    parser.add_argument('--asp-id', help='ASP ID')
    parser.add_argument('--media-id', help='Media ID')
    parser.add_argument('--asp-name', default='もしも（ビギナーズ）', help='ASP名')
    parser.add_argument('--media-name', default='ビギナーズ', help='メディア名')
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
