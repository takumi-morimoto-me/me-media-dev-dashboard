"""Anthropic Claude API client for natural language scenario interpretation."""

import logging
import json
import base64
from typing import Dict, Any, Optional
from anthropic import Anthropic

logger = logging.getLogger(__name__)


class ClaudeClient:
    """Client for interacting with Anthropic Claude API."""

    def __init__(self, api_key: str, model_name: str = "claude-3-5-sonnet-20241022"):
        """Initialize Claude client.

        Args:
            api_key: Anthropic API key
            model_name: Model name (default: claude-3-5-sonnet-20241022)
        """
        self.api_key = api_key
        self.model_name = model_name
        self.client = Anthropic(api_key=api_key)

        logger.info(f"Claude client initialized with model: {model_name}")

    def interpret_scenario_step(
        self, scenario_step: str, page_context: str, screenshot_base64: Optional[str] = None
    ) -> Dict[str, Any]:
        """Interpret a scenario step and return the next action to take.

        Args:
            scenario_step: A single step from the scenario (e.g., "Click the login button")
            page_context: Current page HTML or simplified context
            screenshot_base64: Optional base64 encoded screenshot of the page

        Returns:
            Dictionary containing:
            - action: Type of action (e.g., "click", "fill", "navigate", "extract")
            - selector: CSS selector or element description
            - value: Value to input (for "fill" actions)
            - data: Extracted data (for "extract" actions)
        """
        messages = []

        # Build the text prompt
        prompt_text = self._build_interpretation_prompt(scenario_step, page_context)

        # If screenshot provided, add it as an image
        if screenshot_base64:
            messages.append({
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": "image/jpeg",
                            "data": screenshot_base64,
                        },
                    },
                    {
                        "type": "text",
                        "text": prompt_text
                    }
                ]
            })
            logger.info("Image data included in prompt")
        else:
            messages.append({
                "role": "user",
                "content": prompt_text
            })

        try:
            response = self.client.messages.create(
                model=self.model_name,
                max_tokens=1024,
                messages=messages
            )

            result = self._parse_claude_response(response.content[0].text)

            logger.info(f"Interpreted step: {scenario_step} -> {result}")
            return result

        except Exception as e:
            logger.error(f"Error interpreting scenario step: {e}")
            return {"action": "error", "message": str(e)}

    def _build_interpretation_prompt(
        self, scenario_step: str, page_context: str
    ) -> str:
        """Build prompt for Claude to interpret scenario step.

        Args:
            scenario_step: The instruction to interpret
            page_context: Current page context

        Returns:
            Formatted prompt string
        """
        return f"""あなたはWebブラウザ操作のエキスパートです。
提供されたスクリーンショット（もしあれば）とHTMLコンテキストを使用して、
以下のシナリオステップを具体的なブラウザ操作コマンドに変換してください。

【シナリオステップ】
{scenario_step}

【現在のページ情報】
{page_context[:2000]}

【指示】
このステップを実行するために必要な操作を、以下のJSON形式で返してください：

{{
  "action": "click" | "fill" | "navigate" | "wait" | "extract" | "hover",
  "selector": "CSS selector or description of element",
  "value": "value to input (for fill/wait actions)",
  "instruction": "extraction instruction (for extract actions)",
  "target": "daily_actuals | monthly_actuals (for extract actions)"
}}

重要な注意事項：
1. セレクタは標準的なCSSセレクタのみ使用してください（:first-of-type、:nth-of-type()などの疑似セレクタは使わない）
2. 動的な値（ユーザー名など）を含むセレクタは使わないでください
3. "input[type='text']"、"input[type='password']"などのシンプルなセレクタを推奨
4. ホバーが必要な場合は"action": "hover"を使用してください

例：
- "ログインボタンをクリック" → {{"action": "click", "selector": "input[type='submit'][value='ログイン']"}}
- "ログインID入力欄（type=text）にユーザー名を入力" → {{"action": "fill", "selector": "input[type='text']", "value": "USERNAME_PLACEHOLDER"}}
- "パスワード入力欄（type=password）にパスワードを入力" → {{"action": "fill", "selector": "input[type='password']", "value": "PASSWORD_PLACEHOLDER"}}
- "待機 (3000ms)" → {{"action": "wait", "value": "3000"}}
- "「レポート」リンクにマウスをホバー" → {{"action": "hover", "selector": "text=レポート"}}
- "テーブルから日別の確定報酬データを抽出して daily_actuals テーブルに保存" → {{
    "action": "extract",
    "selector": "table",
    "instruction": "テーブルから日別の確定報酬データ（日付と金額）を抽出してJSON形式で返す",
    "target": "daily_actuals"
  }}

必ずJSON形式のみを返してください。説明文は不要です。
"""

    def _parse_claude_response(self, response_text: str) -> Dict[str, Any]:
        """Parse Claude's response into structured command.

        Args:
            response_text: Raw response from Claude

        Returns:
            Parsed command dictionary
        """
        try:
            # Remove markdown code blocks if present
            text = response_text.strip()
            if text.startswith("```"):
                text = text.split("```")[1]
                if text.startswith("json"):
                    text = text[4:]
                text = text.strip()

            # Parse JSON
            command = json.loads(text)

            return command

        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse Claude response as JSON: {e}")
            logger.error(f"Response text: {response_text}")
            return {"action": "error", "message": "Failed to parse response"}

    def extract_data_from_page(
        self, page_content: str, extraction_instruction: str
    ) -> Optional[str]:
        """Extract specific data from page content using Claude.

        Args:
            page_content: HTML content of the page
            extraction_instruction: What data to extract

        Returns:
            Extracted data as JSON string, or None if extraction failed
        """
        prompt = f"""あなたはWebページからデータを抽出するエキスパートです。

以下のHTMLから、指定されたデータを抽出してJSON形式で返してください。

【抽出指示】
{extraction_instruction}

【HTMLコンテンツ】
{page_content[:8000]}

【指示】
テーブルデータの場合は、以下のJSON配列形式で返してください：

{{
  "data": [
    {{"date": "2025-11-01", "amount": 1500}},
    {{"date": "2025-11-02", "amount": 2300}},
    ...
  ]
}}

単一の値の場合は、以下の形式で返してください：

{{
  "value": "抽出された値"
}}

必ずJSON形式のみを返してください。説明文は不要です。
金額の場合は、カンマや「円」を除いた数値のみを返してください。
"""

        try:
            response = self.client.messages.create(
                model=self.model_name,
                max_tokens=2048,
                messages=[{
                    "role": "user",
                    "content": prompt
                }]
            )

            extracted_data = response.content[0].text.strip()

            # Remove markdown code blocks if present
            if extracted_data.startswith("```"):
                extracted_data = extracted_data.split("```")[1]
                if extracted_data.startswith("json"):
                    extracted_data = extracted_data[4:]
                extracted_data = extracted_data.strip()

            logger.info(f"Extracted data: {extracted_data[:200]}...")
            return extracted_data

        except Exception as e:
            logger.error(f"Error extracting data: {e}")
            return None
