"""A8.netを直接Playwrightでテストするスクリプト"""

from playwright.sync_api import sync_playwright
import time
import os
from dotenv import load_dotenv

load_dotenv()

def test_a8net():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False, slow_mo=500)
        page = browser.new_page()

        try:
            print('1. A8.netログインページにアクセス')
            page.goto('https://www.a8.net/', wait_until='domcontentloaded', timeout=60000)
            time.sleep(2)
            page.screenshot(path='screenshots/a8net_test_1_login_page.png')

            print('2. ログイン情報を入力')
            page.fill('input[name="login"]', os.getenv('A8NET_USERNAME', 'takakuureru'))
            page.fill('input[name="passwd"]', os.getenv('A8NET_PASSWORD', 'Hu8nE23xdpf7'))
            print('   ログイン情報入力完了')
            time.sleep(1)
            page.screenshot(path='screenshots/a8net_test_2_credentials_filled.png')

            print('3. ログインボタンをクリック')
            page.click('input[name="login_as_btn"]')
            time.sleep(3)
            page.screenshot(path='screenshots/a8net_test_3_after_login.png')

            print(f'4. ログイン後のURL: {page.url}')

            print('5. レポートメニューをクリック')
            page.click('text=レポート')
            time.sleep(2)
            page.screenshot(path='screenshots/a8net_test_4_report_menu.png')

            print('6. 成果報酬をクリック')
            page.click('text=成果報酬')
            time.sleep(3)
            page.screenshot(path='screenshots/a8net_test_5_performance_menu.png')

            print('7. 日別タブをクリック')
            page.click('text=日別')
            time.sleep(3)
            page.screenshot(path='screenshots/a8net_test_6_daily_report.png')

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

        except Exception as e:
            print(f'\n❌ エラー: {e}')
            page.screenshot(path='screenshots/a8net_test_error.png')
            import traceback
            traceback.print_exc()

        finally:
            time.sleep(2)
            browser.close()

if __name__ == '__main__':
    test_a8net()
