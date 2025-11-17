"""Link-AGを直接Playwrightでテストするスクリプト v3 - TypeScript版の実装を参考"""

from playwright.sync_api import sync_playwright
import time
import os
from dotenv import load_dotenv

load_dotenv()

def test_linkag():
    with sync_playwright() as p:
        # TypeScript版と同じブラウザ設定を使用
        browser = p.chromium.launch(headless=False, slow_mo=500)
        context = browser.new_context(
            user_agent='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            viewport={'width': 1280, 'height': 720},
            locale='ja-JP',
            timezone_id='Asia/Tokyo'
        )
        page = context.new_page()

        try:
            print('1. Link-AGログインページにアクセス')
            page.goto('https://link-ag.net/', wait_until='domcontentloaded', timeout=60000)
            time.sleep(3)
            page.screenshot(path='screenshots/linkag_v3_test_1_login_page.png', full_page=True)

            print('2. 入力フィールドを探す（TypeScript版のロジック）')
            # text/email/password inputのみを取得
            text_inputs = page.locator('input[type="text"], input[type="email"], input:not([type])').all()
            password_inputs = page.locator('input[type="password"]').all()

            print(f'   テキスト入力フィールド数: {len(text_inputs)}')
            print(f'   パスワード入力フィールド数: {len(password_inputs)}')

            if len(text_inputs) >= 2 and len(password_inputs) >= 2:
                print('3. パートナーログインにログインID入力中...')
                # 最初の入力フィールド = パートナーログインのログインID
                text_inputs[0].fill(os.getenv('LINKAG_USERNAME', 'rere-dev'))
                time.sleep(1)
                page.screenshot(path='screenshots/linkag_v3_test_2_username_filled.png')

                print('4. パスワード入力中...')
                # 最初のパスワードフィールド = パートナーログインのパスワード
                password_inputs[0].fill(os.getenv('LINKAG_PASSWORD', 'ydh563czoq'))
                time.sleep(1)
                page.screenshot(path='screenshots/linkag_v3_test_3_password_filled.png')

                print('5. ログインボタンを探す')
                # TypeScript版と同じロジック: button, input[type="submit"], aタグを探す
                login_buttons = page.locator('button:has-text("ログイン"), input[type="submit"][value*="ログイン"], a:has-text("ログイン")').all()
                print(f'   ログインボタン数: {len(login_buttons)}')

                if len(login_buttons) > 0:
                    print('6. パートナーログインボタンをクリック中...')
                    login_buttons[0].click()
                    time.sleep(5)
                    page.screenshot(path='screenshots/linkag_v3_test_4_after_login.png', full_page=True)
                else:
                    print('   ⚠️ ログインボタンが見つかりません - すべてのbuttonとsubmitを探す')
                    all_buttons = page.locator('button, input[type="submit"]').all()
                    print(f'   全ボタン数: {len(all_buttons)}')

                    if len(all_buttons) >= 2:
                        print('   最初のボタン（パートナーログイン用と推定）をクリック中...')
                        all_buttons[0].click()
                        time.sleep(5)
                        page.screenshot(path='screenshots/linkag_v3_test_4_after_login.png', full_page=True)

                print(f'7. ログイン後のURL: {page.url}')

                # ログイン成功確認
                if 'sign_in' in page.url or page.url == 'https://link-ag.net/':
                    print('   ⚠️ ログイン失敗 - まだログインページにいます')
                else:
                    print('   ✅ ログイン成功!')

            else:
                print('   ⚠️ ログインフィールドが見つかりませんでした')

            print('8. 日別レポートページに移動')
            page.goto('https://link-ag.net/partner/summaries/dates', wait_until='domcontentloaded')
            time.sleep(3)
            page.screenshot(path='screenshots/linkag_v3_test_5_daily_report.png', full_page=True)

            print(f'9. 最終URL: {page.url}')

            print('10. テーブルを確認')
            tables = page.locator('table').all()
            print(f'   テーブル数: {len(tables)}')

            if len(tables) > 0:
                # TypeScript版は最後のテーブルを使用
                table = page.locator('table').last
                rows = table.locator('tbody tr').all()
                print(f'   最後のテーブルの行数: {len(rows)}')

                for i, row in enumerate(rows[:5]):
                    cells = row.locator('td').all_text_contents()
                    print(f'   Row {i}: {cells}')

            print('\n✅ テスト成功！')

        except Exception as e:
            print(f'\n❌ エラー: {e}')
            page.screenshot(path='screenshots/linkag_v3_test_error.png', full_page=True)
            import traceback
            traceback.print_exc()

        finally:
            time.sleep(2)
            context.close()
            browser.close()

if __name__ == '__main__':
    test_linkag()
