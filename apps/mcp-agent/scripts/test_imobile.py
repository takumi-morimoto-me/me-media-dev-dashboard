"""i-mobile を直接Playwrightでテストするスクリプト"""

from playwright.sync_api import sync_playwright
import time
import os
from dotenv import load_dotenv

load_dotenv()

def test_imobile():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False, slow_mo=500)
        context = browser.new_context(
            user_agent='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            viewport={'width': 1280, 'height': 720},
            locale='ja-JP',
            timezone_id='Asia/Tokyo'
        )
        page = context.new_page()

        try:
            print('1. i-mobile ログインページにアクセス')
            page.goto('https://app.i-mobile.co.jp/', wait_until='networkidle', timeout=60000)
            time.sleep(5)
            page.screenshot(path='screenshots/imobile_test_1_login_page.png')

            print('2. ログインフォームを確認 (全input要素をチェック)')
            # より広い範囲で検索
            all_inputs = page.locator('input').count()
            print(f'   全input要素数: {all_inputs}')

            login_inputs = page.locator('input[type="email"], input[type="text"], input[name*="email"], input[name*="login"]').count()
            password_inputs = page.locator('input[type="password"]').count()
            print(f'   ログイン入力フィールド数: {login_inputs}')
            print(f'   パスワード入力フィールド数: {password_inputs}')

            if login_inputs > 0 and password_inputs > 0:
                print('3. ログイン情報を入力')
                page.locator('input[type="email"], input[type="text"], input[name*="email"], input[name*="login"]').first.fill(
                    os.getenv('IMOBILE_USERNAME', 'test')
                )
                print('   ログインID入力完了')
                time.sleep(0.5)

                page.locator('input[type="password"]').first.fill(
                    os.getenv('IMOBILE_PASSWORD', 'test')
                )
                print('   パスワード入力完了')
                time.sleep(0.5)
                page.screenshot(path='screenshots/imobile_test_2_credentials_filled.png')

                print('4. ログインボタンをクリック')
                login_buttons = page.locator('button[type="submit"], input[type="submit"], button:has-text("ログイン")').count()
                print(f'   ログインボタン数: {login_buttons}')

                if login_buttons > 0:
                    page.locator('button[type="submit"], input[type="submit"], button:has-text("ログイン")').first.click()
                    time.sleep(5)
                    page.screenshot(path='screenshots/imobile_test_3_after_login.png')

                    print(f'5. ログイン後のURL: {page.url}')

                    print('6. レポートリンクを探す')
                    report_links = page.locator('a:has-text("レポート"), a:has-text("統計"), a[href*="report"], a[href*="stats"]').count()
                    print(f'   レポートリンク数: {report_links}')

                    if report_links > 0:
                        page.locator('a:has-text("レポート"), a:has-text("統計"), a[href*="report"], a[href*="stats"]').first.click()
                        time.sleep(3)
                        page.screenshot(path='screenshots/imobile_test_4_report_page.png')

                    print('7. テーブルを確認')
                    tables = page.locator('table').all()
                    print(f'   テーブル数: {len(tables)}')

                    if len(tables) > 0:
                        rows = page.locator('table').first.locator('tbody tr, tr').all()
                        print(f'   最初のテーブルの行数: {len(rows)}')

                        for i, row in enumerate(rows[:5]):
                            cells = row.locator('td, th').all_text_contents()
                            print(f'   Row {i}: {cells}')

                    print('\n✅ テスト成功！')
            else:
                print('⚠️ ログインフィールドが見つかりませんでした')

        except Exception as e:
            print(f'\n❌ エラー: {e}')
            page.screenshot(path='screenshots/imobile_test_error.png')
            import traceback
            traceback.print_exc()

        finally:
            time.sleep(2)
            context.close()
            browser.close()

if __name__ == '__main__':
    test_imobile()
