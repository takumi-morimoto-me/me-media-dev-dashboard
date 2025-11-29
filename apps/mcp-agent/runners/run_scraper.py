#!/usr/bin/env python3
"""
汎用スクレイパーランナー

ASP名とメディア名を指定してスクレイパーを実行する。
認証情報はasp_credentialsテーブルから自動取得。

Usage:
    # 名前指定
    python run_scraper.py --asp "もしも（ビギナーズ）" --media "ビギナーズ" --daily

    # ID指定
    python run_scraper.py --asp-id xxx --media-id yyy --monthly

    # ブラウザ表示
    python run_scraper.py --asp "A8.net" --media "ReRe" --daily --no-headless
"""
import os
import sys
import argparse
from pathlib import Path

# プロジェクトルートをパスに追加
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from dotenv import load_dotenv
load_dotenv(Path(__file__).resolve().parent.parent / '.env')

from supabase import create_client


def get_supabase():
    """Supabaseクライアントを取得"""
    return create_client(
        os.getenv('SUPABASE_URL'),
        os.getenv('SUPABASE_SERVICE_ROLE_KEY')
    )


def resolve_ids(asp_name: str = None, media_name: str = None, asp_id: str = None, media_id: str = None):
    """ASP名/メディア名からIDを解決"""
    supabase = get_supabase()

    # ASP ID
    if not asp_id and asp_name:
        result = supabase.table('asps').select('id, name').eq('name', asp_name).execute()
        if not result.data:
            # 部分一致で検索
            result = supabase.table('asps').select('id, name').ilike('name', f'%{asp_name}%').execute()
            if not result.data:
                raise ValueError(f"ASP not found: {asp_name}")
            if len(result.data) > 1:
                print(f"Multiple ASPs found for '{asp_name}':")
                for asp in result.data:
                    print(f"  - {asp['name']}")
                raise ValueError("Please specify exact ASP name")
        asp_id = result.data[0]['id']
        print(f"ASP: {result.data[0]['name']} ({asp_id})")

    # Media ID
    if not media_id and media_name:
        result = supabase.table('media').select('id, name').eq('name', media_name).execute()
        if not result.data:
            result = supabase.table('media').select('id, name').ilike('name', f'%{media_name}%').execute()
            if not result.data:
                raise ValueError(f"Media not found: {media_name}")
            if len(result.data) > 1:
                print(f"Multiple media found for '{media_name}':")
                for m in result.data:
                    print(f"  - {m['name']}")
                raise ValueError("Please specify exact media name")
        media_id = result.data[0]['id']
        print(f"Media: {result.data[0]['name']} ({media_id})")

    return asp_id, media_id


def get_scraper_class(asp_name: str):
    """ASP名からスクレイパークラスを取得"""
    # ASP名とスクレイパーモジュールのマッピング
    scraper_mapping = {
        'もしも': 'scrapers.moshimo.scraper',
        'moshimo': 'scrapers.moshimo.scraper',
        'アクセストレード': 'scrapers.accesstrade.scraper',
        'accesstrade': 'scrapers.accesstrade.scraper',
        'a8.net': 'scrapers.a8net.scraper',
        'a8（ビギナーズ）': 'scrapers.a8net.scraper',
        'afb': 'scrapers.afb.scraper',
        'affitown': 'scrapers.affitown.scraper',
        'circuitx': 'scrapers.circuitx.scraper',
        'felmat': 'scrapers.felmat.scraper',
        'link-ag': 'scrapers.linkag.scraper',
        'seedapp': 'scrapers.a8app.scraper',
        'smaad': 'scrapers.gmosmaaffi.scraper',
        'webridge': 'scrapers.webridge.scraper',
        'ultelo': 'scrapers.ultelo.scraper',
        'valuecommerce': 'scrapers.valuecommerce.scraper',
        'バリューコマース': 'scrapers.valuecommerce.scraper',
    }

    asp_lower = asp_name.lower()
    for key, module_path in scraper_mapping.items():
        if key in asp_lower:
            try:
                module = __import__(module_path, fromlist=[''])
                # スクレイパークラスを探す
                for attr_name in dir(module):
                    attr = getattr(module, attr_name)
                    if isinstance(attr, type) and attr_name.endswith('Scraper') and attr_name != 'BaseScraper':
                        return attr
            except ImportError as e:
                print(f"Warning: Could not import {module_path}: {e}")
                continue

    return None


def list_available_scrapers():
    """利用可能なスクレイパーを一覧表示"""
    scrapers_dir = Path(__file__).resolve().parent.parent / 'scrapers'
    print("\n利用可能なスクレイパー:")

    for asp_dir in scrapers_dir.iterdir():
        if asp_dir.is_dir() and not asp_dir.name.startswith('_'):
            scraper_file = asp_dir / 'scraper.py'
            if scraper_file.exists():
                print(f"  ✓ {asp_dir.name}")
            else:
                daily_file = asp_dir / 'daily.py'
                if daily_file.exists():
                    print(f"  △ {asp_dir.name} (旧形式)")


def list_asps_with_credentials(media_name: str = None):
    """認証情報のあるASPを一覧表示"""
    supabase = get_supabase()

    query = supabase.table('asp_credentials').select(
        'asp_id, media_id, asps(name), media(name)'
    )

    if media_name:
        media_result = supabase.table('media').select('id').eq('name', media_name).execute()
        if media_result.data:
            query = query.eq('media_id', media_result.data[0]['id'])

    result = query.execute()

    print("\n認証情報が登録されているASP:")
    for cred in result.data:
        asp_name = cred.get('asps', {}).get('name', 'Unknown')
        media_name = cred.get('media', {}).get('name', 'Unknown')
        print(f"  - {asp_name} / {media_name}")


def main():
    parser = argparse.ArgumentParser(
        description="汎用スクレイパーランナー",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # 日次データ取得
  python run_scraper.py --asp "もしも（ビギナーズ）" --media "ビギナーズ" --daily

  # 月次データ取得
  python run_scraper.py --asp "A8.net" --media "ReRe" --monthly

  # ブラウザ表示モード
  python run_scraper.py --asp "afb" --media "ビギナーズ" --daily --no-headless

  # 利用可能なスクレイパーを確認
  python run_scraper.py --list

  # 認証情報があるASPを確認
  python run_scraper.py --list-asps
        """
    )

    # 識別子
    parser.add_argument('--asp', help='ASP名')
    parser.add_argument('--media', help='メディア名')
    parser.add_argument('--asp-id', help='ASP ID（直接指定）')
    parser.add_argument('--media-id', help='メディアID（直接指定）')

    # 実行タイプ
    parser.add_argument('--daily', action='store_true', help='日次データを取得')
    parser.add_argument('--monthly', action='store_true', help='月次データを取得')

    # オプション
    parser.add_argument('--no-headless', action='store_true', help='ブラウザを表示')
    parser.add_argument('--retries', type=int, default=3, help='リトライ回数')

    # 情報表示
    parser.add_argument('--list', action='store_true', help='利用可能なスクレイパーを表示')
    parser.add_argument('--list-asps', action='store_true', help='認証情報のあるASPを表示')

    args = parser.parse_args()

    # 情報表示
    if args.list:
        list_available_scrapers()
        return

    if args.list_asps:
        list_asps_with_credentials(args.media)
        return

    # 必須チェック
    if not args.asp and not args.asp_id:
        parser.print_help()
        print("\nError: --asp または --asp-id を指定してください")
        sys.exit(1)

    if not args.media and not args.media_id:
        parser.print_help()
        print("\nError: --media または --media-id を指定してください")
        sys.exit(1)

    if not args.daily and not args.monthly:
        parser.print_help()
        print("\nError: --daily または --monthly を指定してください")
        sys.exit(1)

    # ID解決
    try:
        asp_id, media_id = resolve_ids(
            asp_name=args.asp,
            media_name=args.media,
            asp_id=args.asp_id,
            media_id=args.media_id
        )
    except ValueError as e:
        print(f"Error: {e}")
        sys.exit(1)

    # スクレイパー取得
    asp_name = args.asp or ''
    if not asp_name and asp_id:
        supabase = get_supabase()
        result = supabase.table('asps').select('name').eq('id', asp_id).execute()
        if result.data:
            asp_name = result.data[0]['name']

    ScraperClass = get_scraper_class(asp_name)

    if not ScraperClass:
        print(f"Error: スクレイパーが見つかりません: {asp_name}")
        print("利用可能なスクレイパーは --list で確認できます")
        sys.exit(1)

    # スクレイパー実行
    headless = not args.no_headless
    scraper = ScraperClass(
        asp_id=asp_id,
        media_id=media_id,
        headless=headless,
        max_retries=args.retries
    )

    if args.monthly:
        result = scraper.run_monthly()
    else:
        result = scraper.run_daily()

    print(f"\nResult: {result}")

    if result.get('success'):
        sys.exit(0)
    else:
        sys.exit(1)


if __name__ == "__main__":
    main()
