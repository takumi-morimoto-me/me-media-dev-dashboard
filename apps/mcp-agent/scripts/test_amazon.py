"""Amazon Associates (Amazonアソシエイト) を直接Playwrightでテストするスクリプト"""

from playwright.sync_api import sync_playwright
import time
import os
from dotenv import load_dotenv

load_dotenv()

def test_amazon():
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
            print('1. Amazonアソシエイト ログインページにアクセス')
            page.goto('https://affiliate.amazon.co.jp/', wait_until='domcontentloaded', timeout=60000)
            time.sleep(3)
            page.screenshot(path='screenshots/amazon_test_1_initial_page.png')

            print('2. ログインリンクを探す')
            login_links = page.locator('a:has-text("ログイン"), a:has-text("サインイン"), a[href*="signin"]').count()
            print(f'   ログインリンク数: {login_links}')

            if login_links > 0:
                print('3. ログインリンクをクリック')
                page.locator('a:has-text("ログイン"), a:has-text("サインイン"), a[href*="signin"]').first.click()
                time.sleep(3)
                page.screenshot(path='screenshots/amazon_test_2_login_page.png')

            print('4. ログインフォームを確認')
            email_inputs = page.locator('input[type="email"], input[name="email"], input#ap_email').count()
            password_inputs = page.locator('input[type="password"]').count()
            print(f'   メール入力フィールド数: {email_inputs}')
            print(f'   パスワード入力フィールド数: {password_inputs}')

            if email_inputs > 0:
                print('5. メールアドレスを入力')
                page.locator('input[type="email"], input[name="email"], input#ap_email').first.fill(
                    os.getenv('AMAZON_USERNAME', 'test')
                )
                print('   メールアドレス入力完了')
                time.sleep(0.5)

                # Amazonは2段階認証の可能性があるので、まずContinueボタンがあるか確認
                continue_buttons = page.locator('input#continue, button:has-text("続行")').count()
                if continue_buttons > 0:
                    print('6. 続行ボタンをクリック')
                    page.locator('input#continue, button:has-text("続行")').first.click()
                    time.sleep(2)
                    page.screenshot(path='screenshots/amazon_test_3_after_continue.png')

                password_inputs = page.locator('input[type="password"]').count()
                print(f'   パスワード入力フィールド数: {password_inputs}')

                if password_inputs > 0:
                    print('7. パスワードを入力')
                    page.locator('input[type="password"]').first.fill(
                        os.getenv('AMAZON_PASSWORD', 'test')
                    )
                    print('   パスワード入力完了')
                    time.sleep(0.5)
                    page.screenshot(path='screenshots/amazon_test_4_credentials_filled.png')

                    print('8. ログインボタンをクリック')
                    login_buttons = page.locator('input#signInSubmit, button[type="submit"], input[type="submit"]').count()
                    print(f'   ログインボタン数: {login_buttons}')

                    if login_buttons > 0:
                        page.locator('input#signInSubmit, button[type="submit"], input[type="submit"]').first.click()
                        time.sleep(5)
                        page.screenshot(path='screenshots/amazon_test_5_after_login.png')

                        print(f'9. ログイン後のURL: {page.url}')

                        print('10. レポートリンクを探す')
                        report_links = page.locator('a:has-text("レポート"), a:has-text("Report"), a[href*="report"]').count()
                        print(f'   レポートリンク数: {report_links}')

                        if report_links > 0:
                            page.locator('a:has-text("レポート"), a:has-text("Report"), a[href*="report"]').first.click()
                            time.sleep(3)
                            page.screenshot(path='screenshots/amazon_test_6_report_page.png')

                        print('11. テーブルを確認')
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
            page.screenshot(path='screenshots/amazon_test_error.png')
            import traceback
            traceback.print_exc()

        finally:
            time.sleep(2)
            context.close()
            browser.close()

if __name__ == '__main__':
    test_amazon()
