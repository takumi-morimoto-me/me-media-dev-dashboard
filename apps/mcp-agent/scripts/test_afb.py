"""afb (アフィリエイトB) を直接Playwrightでテストするスクリプト"""

from playwright.sync_api import sync_playwright
import time
import os
from dotenv import load_dotenv

load_dotenv()

def test_afb():
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
            print('1. afbログインページにアクセス')
            page.goto('https://www.afi-b.com/', wait_until='domcontentloaded', timeout=60000)
            time.sleep(2)
            page.screenshot(path='screenshots/afb_test_1_login_page.png')

            print('2. ログインフォームを確認')
            text_inputs = page.locator('input[type="text"]').count()
            password_inputs = page.locator('input[type="password"]').count()
            print(f'   テキスト入力フィールド数: {text_inputs}')
            print(f'   パスワード入力フィールド数: {password_inputs}')

            if text_inputs > 0 and password_inputs > 0:
                print('3. ログイン情報を入力')
                page.fill('input[type="text"]', os.getenv('AFB_USERNAME', 'test'))
                print('   ログインID入力完了')
                time.sleep(0.5)

                page.fill('input[type="password"]', os.getenv('AFB_PASSWORD', 'test'))
                print('   パスワード入力完了')
                time.sleep(1)
                page.screenshot(path='screenshots/afb_test_2_credentials_filled.png')

                print('4. ログインボタンをクリック')
                login_buttons = page.locator('button, input[type="submit"]').count()
                print(f'   ログインボタン数: {login_buttons}')

                page.click('button, input[type="submit"]')
                time.sleep(3)
                page.screenshot(path='screenshots/afb_test_3_after_login.png')

                print(f'5. ログイン後のURL: {page.url}')

                print('6. レポートメニューにホバー')
                report_menu = page.locator('text=レポート').first
                report_menu.hover()
                time.sleep(2)
                page.screenshot(path='screenshots/afb_test_4_report_hover.png')

                print('7. 日別レポートをクリック')
                page.click('text=日別レポート')
                time.sleep(3)
                page.screenshot(path='screenshots/afb_test_5_daily_report.png')

                print(f'8. 最終URL: {page.url}')

                print('9. テーブルを確認')
                tables = page.locator('table').all()
                print(f'   テーブル数: {len(tables)}')

                if len(tables) > 0:
                    # 最初のテーブルの行数を確認
                    rows = page.locator('table').first.locator('tbody tr').all()
                    print(f'   最初のテーブルの行数: {len(rows)}')

                    # 最初の数行のデータを表示
                    for i, row in enumerate(rows[:5]):
                        cells = row.locator('td').all_text_contents()
                        print(f'   Row {i}: {cells}')

                print('\n✅ テスト成功！')
            else:
                print('⚠️ ログインフィールドが見つかりませんでした')

        except Exception as e:
            print(f'\n❌ エラー: {e}')
            page.screenshot(path='screenshots/afb_test_error.png')
            import traceback
            traceback.print_exc()

        finally:
            time.sleep(2)
            context.close()
            browser.close()

if __name__ == '__main__':
    test_afb()
