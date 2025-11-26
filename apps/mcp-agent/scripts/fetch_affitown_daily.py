"""
affitownの日次データをCSVダウンロードで取得してdaily_actualsに保存するスクリプト
"""
import os
import re
import csv
from datetime import datetime
from pathlib import Path
from playwright.sync_api import sync_playwright
from supabase import create_client

# Supabase設定
SUPABASE_URL = os.getenv('SUPABASE_URL', 'https://pkjrepxggkbybkjifiqt.supabase.co')
SUPABASE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBranJlcHhnZ2tieWJramlmaXF0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTcyNzA3NiwiZXhwIjoyMDc1MzAzMDc2fQ.HpV3ZJxATuesWehBG9Y9dSi4XRIeWXe05vCHXktY-1Y')
client = create_client(SUPABASE_URL, SUPABASE_KEY)

# ダウンロードディレクトリ
DOWNLOAD_DIR = Path('/tmp/affitown_csv')

# affitown認証情報
AFFITOWN_USERNAME = "3gVh5Ib9"
AFFITOWN_PASSWORD = "Nw9fKCdD"


def parse_amount(text: str) -> int:
    """金額文字列を整数に変換"""
    cleaned = re.sub(r'[^\d]', '', str(text))
    return int(cleaned) if cleaned else 0


def parse_date(text: str, year: str = None) -> str:
    """日付文字列をYYYY-MM-DD形式に変換"""
    # "2025年11月06日" or "2025/11/06" -> "2025-11-06"
    match = re.match(r'(\d{4})[年/](\d{1,2})[月/](\d{1,2})', text)
    if match:
        year, month, day = match.groups()
        return f"{year}-{int(month):02d}-{int(day):02d}"

    # "11月06日" -> "2025-11-06" (年がない場合)
    match = re.match(r'(\d{1,2})月(\d{1,2})日', text)
    if match and year:
        month, day = match.groups()
        return f"{year}-{int(month):02d}-{int(day):02d}"

    return None


def parse_csv_file(filepath: Path) -> list:
    """CSVファイルをパースしてレコードリストを返す"""
    records = []

    # ファイル名から年を取得 (daily_2025-11.csv -> 2025)
    filename = filepath.stem  # daily_2025-11
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

            date = parse_date(date_text, year)
            amount = parse_amount(amount_text)

            if date and amount > 0:
                records.append({
                    'date': date,
                    'amount': amount
                })

    return records


def download_daily_csv(page, year_month: str, download_dir: Path) -> Path:
    """指定月の日次CSVをダウンロード"""
    # 時系列レポートページに移動
    page.goto("https://affitown.jp/partneradmin/report/monthly/list")
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


def main():
    print('=' * 60)
    print('affitown 日次データ取得 (CSV)')
    print('=' * 60 + '\n')

    # ダウンロードディレクトリ作成
    DOWNLOAD_DIR.mkdir(parents=True, exist_ok=True)

    # ASP情報を取得
    asp_response = client.table('asps').select('id,name').eq('name', 'アフィタウン').execute()
    if not asp_response.data:
        print('アフィタウンがデータベースに見つかりません')
        return

    asp_id = asp_response.data[0]['id']
    print(f'ASP ID: {asp_id}')

    # メディア情報を取得（ReRe）
    media_response = client.table('media').select('id,name').eq('name', 'ReRe').execute()
    if not media_response.data:
        print('ReReが見つかりません')
        return

    media_id = media_response.data[0]['id']
    print(f'Media ID: {media_id}')

    # account_item_id（アフィリエイト）を取得
    account_item_response = client.table('account_items').select('id').eq('media_id', media_id).eq('name', 'アフィリエイト').execute()
    if not account_item_response.data:
        print('アフィリエイトのaccount_itemが見つかりません')
        return

    account_item_id = account_item_response.data[0]['id']
    print(f'Account Item ID: {account_item_id}\n')

    # ブラウザでCSVダウンロード
    all_records = []

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        context = browser.new_context(accept_downloads=True)
        page = context.new_page()

        # ログイン
        print('Logging in...')
        page.goto("https://affitown.jp/")
        page.wait_for_timeout(2000)
        page.fill("form[action='/partner/login/confirm'] input[name='loginId']", AFFITOWN_USERNAME)
        page.fill("form[action='/partner/login/confirm'] input[name='password']", AFFITOWN_PASSWORD)
        page.click("form[action='/partner/login/confirm'] input[type='submit']")
        page.wait_for_timeout(5000)
        print('Logged in successfully\n')

        # 2025年のデータを取得（1月〜11月）
        months = ['2025-01', '2025-02', '2025-03', '2025-04', '2025-05',
                  '2025-06', '2025-07', '2025-08', '2025-09', '2025-10', '2025-11']

        for month in months:
            csv_path = download_daily_csv(page, month, DOWNLOAD_DIR)
            if csv_path and csv_path.exists():
                records = parse_csv_file(csv_path)
                all_records.extend(records)
                print(f"    Found {len(records)} records with amount > 0\n")

        browser.close()

    print(f'合計レコード数: {len(all_records)}')

    if not all_records:
        print('データが見つかりませんでした')
        return

    # データベースに保存
    print('\nSaving to daily_actuals...')

    # 既存データを削除
    delete_result = client.table('daily_actuals').delete().eq(
        'asp_id', asp_id
    ).eq(
        'media_id', media_id
    ).execute()
    print(f'Deleted existing records')

    # 新規登録
    db_records = []
    for record in all_records:
        db_records.append({
            'date': record['date'],
            'amount': record['amount'],
            'media_id': media_id,
            'asp_id': asp_id,
            'account_item_id': account_item_id
        })

    result = client.table('daily_actuals').insert(db_records).execute()
    print(f'Inserted {len(result.data)} records')

    # 結果サマリー
    print('\n=== 月別サマリー ===')
    monthly_totals = {}
    for record in all_records:
        month = record['date'][:7]
        monthly_totals[month] = monthly_totals.get(month, 0) + record['amount']

    for month, total in sorted(monthly_totals.items()):
        print(f'  {month}: {total:,}円')


if __name__ == '__main__':
    main()
