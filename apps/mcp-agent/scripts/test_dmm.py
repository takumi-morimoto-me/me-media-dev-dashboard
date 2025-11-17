"""DMM アフィリエイト を直接Playwrightでテストするスクリプト"""

from playwright.sync_api import sync_playwright
import time
import os
from dotenv import load_dotenv

load_dotenv()

def test_dmm():
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
            print('1. DMMアフィリエイト ログインページにアクセス')
            page.goto('https://affiliate.dmm.com/', wait_until='domcontentloaded', timeout=60000)
            time.sleep(3)
            page.screenshot(path='screenshots/dmm_test_1_top_page.png')

            print('2. 年齢確認ボタンを探す')
            age_confirm_buttons = page.locator('a:has-text("はい"), button:has-text("はい"), a:has-text("18歳以上"), button:has-text("18歳以上")').count()
            print(f'   年齢確認ボタン数: {age_confirm_buttons}')

            if age_confirm_buttons > 0:
                print('3. はい (18歳以上) をクリック')
                page.locator('a:has-text("はい"), button:has-text("はい"), a:has-text("18歳以上"), button:has-text("18歳以上")').first.click()
                time.sleep(3)
                page.screenshot(path='screenshots/dmm_test_2_after_age_confirm.png')

            print('4. ログインURLに直接移動')
            page.goto('https://accounts.dmm.com/service/login/password/=/path=https%3A%2F%2Faffiliate.dmm.com%2F', wait_until='domcontentloaded', timeout=60000)
            time.sleep(3)
            page.screenshot(path='screenshots/dmm_test_3_login_page.png')

            print('5. ログインフォームを確認')
            login_inputs = page.locator('input[type="email"], input[type="text"], input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="password"])').count()
            password_inputs = page.locator('input[type="password"]').count()
            print(f'   ログイン入力フィールド数: {login_inputs}')
            print(f'   パスワード入力フィールド数: {password_inputs}')

            if login_inputs > 0 and password_inputs > 0:
                print('6. ログイン情報を入力')
                page.locator('input[type="email"], input[type="text"], input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="password"])').first.fill(
                    os.getenv('DMM_USERNAME', 'test')
                )
                print('   ログインID入力完了')
                time.sleep(0.5)

                page.locator('input[type="password"]').first.fill(
                    os.getenv('DMM_PASSWORD', 'test')
                )
                print('   パスワード入力完了')
                time.sleep(0.5)
                page.screenshot(path='screenshots/dmm_test_4_credentials_filled.png')

                print('7. ログインボタンをクリック')
                submit_buttons = page.locator('button[type="submit"], input[type="submit"], button:has-text("ログイン")').count()
                print(f'   送信ボタン数: {submit_buttons}')

                if submit_buttons > 0:
                    page.locator('button[type="submit"], input[type="submit"], button:has-text("ログイン")').first.click()
                    time.sleep(5)
                    page.screenshot(path='screenshots/dmm_test_5_after_login.png')

                    print(f'8. ログイン後のURL: {page.url}')

                    # アカウント状態を確認
                    print('9. アカウント状態を確認')
                    denied_message = page.locator('text=不承認').count()
                    if denied_message > 0:
                        print('   ⚠️ アカウントが不承認のため、レポートアクセス不可')
                        print('   ログインは成功しました')
                        print('\n✅ テスト成功！（ログインのみ）')
                        return

                    print('10. サイドバーメニューを探す')
                    sidebar_links = page.locator('.side-menu a, nav a').all()
                    print(f'   サイドバーリンク数: {len(sidebar_links)}')
                    for link in sidebar_links[:10]:
                        text = link.text_content() or ''
                        href = link.get_attribute('href') or ''
                        if text.strip():
                            print(f'   - {text.strip()}: {href}')

                    print('11. レポートリンクを探す (拡張検索)')
                    report_links = page.locator('a:has-text("レポート"), a:has-text("統計"), a:has-text("実績"), a:has-text("成果"), a[href*="report"], a[href*="stats"]').count()
                    print(f'   レポートリンク数: {report_links}')

                    if report_links > 0:
                        page.locator('a:has-text("レポート"), a:has-text("統計"), a:has-text("実績"), a:has-text("成果"), a[href*="report"], a[href*="stats"]').first.click()
                        time.sleep(3)
                        page.screenshot(path='screenshots/dmm_test_6_report_page.png')

                    print('12. テーブルを確認')
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
            page.screenshot(path='screenshots/dmm_test_error.png')
            import traceback
            traceback.print_exc()

        finally:
            time.sleep(2)
            context.close()
            browser.close()

if __name__ == '__main__':
    test_dmm()
