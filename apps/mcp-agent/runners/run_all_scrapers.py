#!/usr/bin/env python3
"""
全スクレイパー一括実行スクリプト

認証情報が登録されているASP/メディアの組み合わせに対して、
利用可能なスクレイパーをすべて実行する。

Usage:
    # 日次データを取得（すべて）
    python run_all_scrapers.py --daily

    # 月次データを取得（すべて）
    python run_all_scrapers.py --monthly

    # 日次と月次の両方を取得
    python run_all_scrapers.py --daily --monthly

    # 特定のASPだけ実行
    python run_all_scrapers.py --daily --asp moshimo

    # ドライラン（実行せずに対象を確認）
    python run_all_scrapers.py --daily --dry-run

    # ブラウザ表示モード
    python run_all_scrapers.py --daily --no-headless
"""
import os
import sys
import argparse
import json
from pathlib import Path
from datetime import datetime
from typing import Optional

# プロジェクトルートをパスに追加
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from dotenv import load_dotenv
load_dotenv(Path(__file__).resolve().parent.parent / '.env')

from supabase import create_client


# 利用可能なスクレイパーとASP名のマッピング
# すべて新形式（BaseScraper使用、asp_credentialsテーブルから認証情報取得）
AVAILABLE_SCRAPERS = {
    'moshimo': {
        'module': 'scrapers.moshimo.scraper',
        'class_name': 'MoshimoScraper',
        'asp_patterns': ['もしも', 'moshimo'],
        'supports_daily': True,
        'supports_monthly': True,
    },
    'accesstrade': {
        'module': 'scrapers.accesstrade.scraper',
        'class_name': 'AccesstradeScraper',
        'asp_patterns': ['アクセストレード', 'accesstrade'],
        'supports_daily': True,
        'supports_monthly': True,
    },
    'ultelo': {
        'module': 'scrapers.ultelo.scraper',
        'class_name': 'UlteloScraper',
        'asp_patterns': ['ultelo', 'アルテガ'],
        'supports_daily': True,
        'supports_monthly': True,
    },
    'valuecommerce': {
        'module': 'scrapers.valuecommerce.scraper',
        'class_name': 'ValueCommerceScraper',
        'asp_patterns': ['valuecommerce', 'バリューコマース'],
        'supports_daily': False,  # 日次はまだ未実装
        'supports_monthly': True,
    },
    'a8net': {
        'module': 'scrapers.a8net.scraper',
        'class_name': 'A8netScraper',
        'asp_patterns': ['a8.net', 'a8（'],
        'supports_daily': True,
        'supports_monthly': True,
    },
    'a8app': {
        'module': 'scrapers.a8app.scraper',
        'class_name': 'A8appScraper',
        'asp_patterns': ['seedapp', 'a8app'],
        'supports_daily': True,
        'supports_monthly': False,
    },
    'afb': {
        'module': 'scrapers.afb.scraper',
        'class_name': 'AfbScraper',
        'asp_patterns': ['afb', 'アフィリエイトb'],
        'supports_daily': True,
        'supports_monthly': False,
    },
    'affitown': {
        'module': 'scrapers.affitown.scraper',
        'class_name': 'AffitownScraper',
        'asp_patterns': ['affitown', 'アフィタウン'],
        'supports_daily': True,
        'supports_monthly': True,
    },
    'circuitx': {
        'module': 'scrapers.circuitx.scraper',
        'class_name': 'CircuitxScraper',
        'asp_patterns': ['circuitx', 'サーキットx'],
        'supports_daily': True,
        'supports_monthly': False,
    },
    'felmat': {
        'module': 'scrapers.felmat.scraper',
        'class_name': 'FelmatScraper',
        'asp_patterns': ['felmat', 'フェルマ'],
        'supports_daily': True,
        'supports_monthly': True,
    },
    'gmosmaaffi': {
        'module': 'scrapers.gmosmaaffi.scraper',
        'class_name': 'GmoSmaaffiScraper',
        'asp_patterns': ['smaad', 'gmo', 'スマートアフィリ'],
        'supports_daily': True,
        'supports_monthly': True,
    },
    'linkag': {
        'module': 'scrapers.linkag.scraper',
        'class_name': 'LinkagScraper',
        'asp_patterns': ['link-ag', 'linkag', 'リンクエージ'],
        'supports_daily': True,
        'supports_monthly': False,
    },
    'webridge': {
        'module': 'scrapers.webridge.scraper',
        'class_name': 'WebridgeScraper',
        'asp_patterns': ['webridge', 'ウェブリッジ'],
        'supports_daily': True,
        'supports_monthly': True,
    },
}


def get_supabase():
    """Supabaseクライアントを取得"""
    return create_client(
        os.getenv('SUPABASE_URL'),
        os.getenv('SUPABASE_SERVICE_ROLE_KEY')
    )


def get_scraper_for_asp(asp_name: str) -> Optional[dict]:
    """ASP名からスクレイパー情報を取得"""
    asp_lower = asp_name.lower()
    for scraper_key, scraper_info in AVAILABLE_SCRAPERS.items():
        for pattern in scraper_info['asp_patterns']:
            if pattern.lower() in asp_lower:
                return {**scraper_info, 'key': scraper_key}
    return None


def load_scraper_class(scraper_info: dict):
    """スクレイパークラスを動的にロード"""
    module = __import__(scraper_info['module'], fromlist=[''])
    return getattr(module, scraper_info['class_name'])


def get_all_credentials_with_asps():
    """認証情報とASP情報を取得"""
    supabase = get_supabase()

    result = supabase.table('asp_credentials').select(
        'id, asp_id, media_id, asps(id, name, is_active), media(id, name)'
    ).execute()

    return result.data or []


def run_scraper(
    scraper_info: dict,
    asp_id: str,
    media_id: str,
    asp_name: str,
    media_name: str,
    run_daily: bool,
    run_monthly: bool,
    headless: bool,
    max_retries: int
) -> dict:
    """スクレイパーを実行"""
    results = {
        'asp_name': asp_name,
        'media_name': media_name,
        'scraper': scraper_info['key'],
        'daily': None,
        'monthly': None,
    }

    try:
        ScraperClass = load_scraper_class(scraper_info)

        # ValueCommerceは特殊なので別処理
        if scraper_info['key'] == 'valuecommerce':
            scraper = ScraperClass(asp_id=asp_id, media_id=media_id)
        else:
            scraper = ScraperClass(
                asp_id=asp_id,
                media_id=media_id,
                headless=headless,
                max_retries=max_retries
            )

        # 日次データ取得
        if run_daily and scraper_info['supports_daily']:
            print(f"    📊 日次データ取得中...")
            try:
                result = scraper.run_daily()
                results['daily'] = result
                if result.get('success'):
                    print(f"    ✅ 日次: 成功 ({result.get('records_count', 0)}件)")
                else:
                    print(f"    ❌ 日次: 失敗 - {result.get('error', 'Unknown error')}")
            except Exception as e:
                results['daily'] = {'success': False, 'error': str(e)}
                print(f"    ❌ 日次: エラー - {e}")

        # 月次データ取得
        if run_monthly and scraper_info['supports_monthly']:
            print(f"    📈 月次データ取得中...")
            try:
                result = scraper.run_monthly()
                results['monthly'] = result
                if result.get('success'):
                    print(f"    ✅ 月次: 成功 ({result.get('records_count', 0)}件)")
                else:
                    print(f"    ❌ 月次: 失敗 - {result.get('error', 'Unknown error')}")
            except Exception as e:
                results['monthly'] = {'success': False, 'error': str(e)}
                print(f"    ❌ 月次: エラー - {e}")

    except Exception as e:
        print(f"    ❌ スクレイパー初期化エラー: {e}")
        results['error'] = str(e)

    return results


def main():
    parser = argparse.ArgumentParser(
        description="全スクレイパー一括実行",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # 日次データを取得（すべてのASP）
  python run_all_scrapers.py --daily

  # 月次データを取得（すべてのASP）
  python run_all_scrapers.py --monthly

  # 両方取得
  python run_all_scrapers.py --daily --monthly

  # 特定のASPだけ実行（部分一致）
  python run_all_scrapers.py --daily --asp moshimo

  # 実行対象を確認（ドライラン）
  python run_all_scrapers.py --daily --dry-run

  # アクティブなASPのみ実行
  python run_all_scrapers.py --daily --active-only
        """
    )

    # 実行タイプ
    parser.add_argument('--daily', action='store_true', help='日次データを取得')
    parser.add_argument('--monthly', action='store_true', help='月次データを取得')

    # フィルタ
    parser.add_argument('--asp', help='特定のASPのみ実行（部分一致）')
    parser.add_argument('--media', help='特定のメディアのみ実行（部分一致）')
    parser.add_argument('--active-only', action='store_true', help='is_active=TrueのASPのみ実行')

    # オプション
    parser.add_argument('--no-headless', action='store_true', help='ブラウザを表示')
    parser.add_argument('--retries', type=int, default=3, help='リトライ回数')
    parser.add_argument('--dry-run', action='store_true', help='実行せずに対象を確認')
    parser.add_argument('--output', help='結果をJSONファイルに保存')

    args = parser.parse_args()

    # 必須チェック
    if not args.daily and not args.monthly:
        parser.print_help()
        print("\nError: --daily または --monthly を指定してください")
        sys.exit(1)

    print("=" * 60)
    print("🚀 全スクレイパー一括実行")
    print(f"   開始時刻: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"   日次: {'Yes' if args.daily else 'No'}")
    print(f"   月次: {'Yes' if args.monthly else 'No'}")
    if args.asp:
        print(f"   ASPフィルタ: {args.asp}")
    if args.media:
        print(f"   メディアフィルタ: {args.media}")
    if args.active_only:
        print(f"   アクティブのみ: Yes")
    print("=" * 60)

    # 認証情報取得
    credentials = get_all_credentials_with_asps()
    print(f"\n📋 認証情報: {len(credentials)}件")

    # 実行対象をフィルタリング
    targets = []
    for cred in credentials:
        asp_info = cred.get('asps', {})
        media_info = cred.get('media', {})
        asp_name = asp_info.get('name', 'Unknown')
        media_name = media_info.get('name', 'Unknown')
        is_active = asp_info.get('is_active', False)

        # フィルタチェック
        if args.asp and args.asp.lower() not in asp_name.lower():
            continue
        if args.media and args.media.lower() not in media_name.lower():
            continue
        if args.active_only and not is_active:
            continue

        # スクレイパーがあるかチェック
        scraper_info = get_scraper_for_asp(asp_name)
        if not scraper_info:
            continue

        # 日次/月次サポートチェック
        if args.daily and not scraper_info['supports_daily']:
            if not args.monthly:
                continue
        if args.monthly and not scraper_info['supports_monthly']:
            if not args.daily:
                continue

        targets.append({
            'cred': cred,
            'asp_name': asp_name,
            'media_name': media_name,
            'asp_id': cred['asp_id'],
            'media_id': cred['media_id'],
            'scraper_info': scraper_info,
            'is_active': is_active,
        })

    print(f"\n🎯 実行対象: {len(targets)}件")
    for i, target in enumerate(targets, 1):
        status = "🟢" if target['is_active'] else "⚪"
        daily_support = "D" if target['scraper_info']['supports_daily'] else "-"
        monthly_support = "M" if target['scraper_info']['supports_monthly'] else "-"
        print(f"   {i}. {status} {target['asp_name']} / {target['media_name']} [{daily_support}{monthly_support}]")

    print("\n   凡例: 🟢=稼働中, ⚪=未稼働, D=日次対応, M=月次対応")

    if not targets:
        print("\n⚠️  実行対象がありません")
        sys.exit(0)

    if args.dry_run:
        print("\n🔍 ドライラン終了（実際の実行はスキップ）")
        sys.exit(0)

    # 実行
    print("\n" + "=" * 60)
    print("📥 スクレイピング開始")
    print("=" * 60)

    all_results = []
    success_count = 0
    fail_count = 0

    for i, target in enumerate(targets, 1):
        print(f"\n[{i}/{len(targets)}] {target['asp_name']} / {target['media_name']}")

        result = run_scraper(
            scraper_info=target['scraper_info'],
            asp_id=target['asp_id'],
            media_id=target['media_id'],
            asp_name=target['asp_name'],
            media_name=target['media_name'],
            run_daily=args.daily,
            run_monthly=args.monthly,
            headless=not args.no_headless,
            max_retries=args.retries,
        )

        all_results.append(result)

        # 成功/失敗カウント
        daily_result = result.get('daily') or {}
        monthly_result = result.get('monthly') or {}
        if daily_result.get('success') or monthly_result.get('success'):
            success_count += 1
        else:
            fail_count += 1

    # サマリー
    print("\n" + "=" * 60)
    print("📊 実行結果サマリー")
    print("=" * 60)
    print(f"   終了時刻: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"   成功: {success_count}件")
    print(f"   失敗: {fail_count}件")

    # 詳細結果
    print("\n詳細:")
    for result in all_results:
        daily_r = result.get('daily') or {}
        monthly_r = result.get('monthly') or {}
        status = "✅" if daily_r.get('success') or monthly_r.get('success') else "❌"
        daily_count = daily_r.get('records_count', '-') if daily_r else '-'
        monthly_count = monthly_r.get('records_count', '-') if monthly_r else '-'
        print(f"   {status} {result['asp_name']} / {result['media_name']}: 日次={daily_count}, 月次={monthly_count}")

    # JSON出力
    if args.output:
        with open(args.output, 'w', encoding='utf-8') as f:
            json.dump({
                'timestamp': datetime.now().isoformat(),
                'summary': {
                    'total': len(targets),
                    'success': success_count,
                    'fail': fail_count,
                },
                'results': all_results,
            }, f, ensure_ascii=False, indent=2)
        print(f"\n💾 結果を保存: {args.output}")

    # 終了コード
    sys.exit(0 if fail_count == 0 else 1)


if __name__ == "__main__":
    main()
