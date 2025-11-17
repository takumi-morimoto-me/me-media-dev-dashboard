"""felmatを直接Playwrightでテストするスクリプト v2 - ドロップダウン対応"""

from playwright.sync_api import sync_playwright
import time
import os
from dotenv import load_dotenv

load_dotenv()

def test_felmat():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False, slow_mo=500)
        page = browser.new_page()

        try:
            print('1. felmatログインページにアクセス')
            page.goto('https://www.felmat.net/publisher/login')
            time.sleep(2)
            page.screenshot(path='screenshots/felmat_v2_test_1_login_page.png')

            print('2. ユーザー名を入力 - name="p_username"')
            username_field = page.locator('input[name="p_username"]')
            username_field.fill(os.getenv('FELMAT_USERNAME', 'rere-dev'))
            print('   ユーザー名入力完了')
            time.sleep(1)
            page.screenshot(path='screenshots/felmat_v2_test_2_username_filled.png')

            print('3. パスワードを入力 - name="p_password"')
            password_field = page.locator('input[name="p_password"]')
            password_field.fill(os.getenv('FELMAT_PASSWORD', '6345ejrfideg'))
            print('   パスワード入力完了')
            time.sleep(1)
            page.screenshot(path='screenshots/felmat_v2_test_3_password_filled.png')

            print('4. LOG INボタンをクリック')
            login_button = page.locator('text=LOG IN')
            login_button.click()
            print('   ログインボタンクリック完了')
            time.sleep(5)
            page.screenshot(path='screenshots/felmat_v2_test_4_after_login.png')

            print(f'5. 現在のURL: {page.url}')

            print('6. レポートメニューをホバー/クリック')
            # ドロップダウンメニューの場合、ホバーまたはクリックが必要
            # まず、"レポート"の親要素を探す

            # Option 1: ナビゲーションバーの"レポート"リンクをクリック
            report_menu = page.locator('nav a:has-text("レポート"), nav button:has-text("レポート")').first
            if report_menu.count() > 0:
                print('   レポートメニュー（nav内）をクリック')
                report_menu.click()
                time.sleep(2)
                page.screenshot(path='screenshots/felmat_v2_test_5_report_menu_clicked.png')
            else:
                # Option 2: ドロップダウン要素をホバー
                report_dropdown = page.locator('text=レポート').first
                print('   レポートメニューをホバー')
                report_dropdown.hover()
                time.sleep(1)
                page.screenshot(path='screenshots/felmat_v2_test_5_report_menu_hover.png')

            print('7. 日別リンクをクリック')
            # 日別リンクが表示されるまで待機
            daily_link = page.locator('a:has-text("日別")').first
            if daily_link.count() > 0:
                daily_link.click()
                print('   日別リンククリック完了')
                time.sleep(3)
                page.screenshot(path='screenshots/felmat_v2_test_6_daily_report.png')
            else:
                print('   日別リンクが見つかりません - URLで直接アクセス')
                # 直接URLにアクセス
                page.goto('https://www.felmat.net/publisher/reports/daily')
                time.sleep(3)
                page.screenshot(path='screenshots/felmat_v2_test_6_daily_report_direct.png')

            print(f'8. 最終URL: {page.url}')

            print('9. テーブルを確認')
            tables = page.locator('table').all()
            print(f'   テーブル数: {len(tables)}')

            if len(tables) > 0:
                rows = page.locator('table').first.locator('tbody tr').all()
                print(f'   最初のテーブルの行数: {len(rows)}')

                for i, row in enumerate(rows[:5]):
                    cells = row.locator('td').all_text_contents()
                    print(f'   Row {i}: {cells}')

            print('\n✅ テスト成功！')

        except Exception as e:
            print(f'\n❌ エラー: {e}')
            page.screenshot(path='screenshots/felmat_v2_test_error.png')
            import traceback
            traceback.print_exc()

        finally:
            time.sleep(2)
            browser.close()

if __name__ == '__main__':
    test_felmat()
