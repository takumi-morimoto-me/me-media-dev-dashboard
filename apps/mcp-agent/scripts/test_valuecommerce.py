"""ValueCommerceを直接Playwrightでテストするスクリプト"""

from playwright.sync_api import sync_playwright
import time
import os
from dotenv import load_dotenv

load_dotenv()

def test_valuecommerce():
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
            print('1. ValueCommerceログインページにアクセス')
            page.goto('https://aff.valuecommerce.ne.jp/login/', wait_until='domcontentloaded', timeout=90000)
            print('   ページ読み込み完了、JavaScriptの実行を待機')
            time.sleep(5)
            page.screenshot(path='screenshots/vc_test_1_login_page.png')

            print(f'2. ページタイトル: {page.title()}')

            print('3. 入力フィールドを確認')
            text_inputs = page.locator('input[type="text"], input[type="email"], input:not([type])').all()
            password_inputs = page.locator('input[type="password"]').all()

            print(f'   テキスト入力フィールド数: {len(text_inputs)}')
            print(f'   パスワード入力フィールド数: {len(password_inputs)}')

            if len(text_inputs) > 0 and len(password_inputs) > 0:
                print('4. ログイン情報を入力')
                text_inputs[0].fill(os.getenv('VALUECOMMERCE_USERNAME', 'test'))
                time.sleep(0.5)
                password_inputs[0].fill(os.getenv('VALUECOMMERCE_PASSWORD', 'test'))
                time.sleep(0.5)
                print('   ログイン情報入力完了')
                page.screenshot(path='screenshots/vc_test_2_credentials_filled.png')

                print('5. ログインボタンを探す')
                buttons = page.locator('button, input[type="submit"], input[type="button"]').all()
                print(f'   ボタン数: {len(buttons)}')

                for i, btn in enumerate(buttons[:5]):
                    text = btn.text_content() or ''
                    value = btn.get_attribute('value') or ''
                    print(f'   Button {i}: text="{text}", value="{value}"')

                if len(buttons) > 0:
                    print('6. ログインボタンをクリック')
                    buttons[0].click()
                    time.sleep(5)
                    page.screenshot(path='screenshots/vc_test_3_after_login.png')

                print(f'7. ログイン後のURL: {page.url}')
                print('\n✅ テスト成功！')
            else:
                print('⚠️ ログインフィールドが見つかりませんでした')
                print('   フォームの読み込みを待つ必要があるかもしれません')

        except Exception as e:
            print(f'\n❌ エラー: {e}')
            page.screenshot(path='screenshots/vc_test_error.png')
            import traceback
            traceback.print_exc()

        finally:
            time.sleep(2)
            context.close()
            browser.close()

if __name__ == '__main__':
    test_valuecommerce()
