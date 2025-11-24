"""Google Gemini API client for natural language scenario interpretation."""

import logging
import json
from typing import Dict, Any, Optional
import google.generativeai as genai

logger = logging.getLogger(__name__)


class GeminiClient:
    """Client for interacting with Google Gemini API."""

    def __init__(self, api_key: str, model_name: str):
        """Initialize Gemini client.

        Args:
            api_key: Google API key for Gemini
            model_name: Model name (e.g., "gemini-1.5-flash")
        """
        self.api_key = api_key
        self.model_name = model_name

        # Configure Gemini API
        genai.configure(api_key=api_key)

        # Configure safety settings to be more permissive
        safety_settings = [
            {
                "category": "HARM_CATEGORY_HARASSMENT",
                "threshold": "BLOCK_NONE"
            },
            {
                "category": "HARM_CATEGORY_HATE_SPEECH",
                "threshold": "BLOCK_NONE"
            },
            {
                "category": "HARM_CATEGORY_SEXUALLY_EXPLICIT",
                "threshold": "BLOCK_NONE"
            },
            {
                "category": "HARM_CATEGORY_DANGEROUS_CONTENT",
                "threshold": "BLOCK_NONE"
            }
        ]

        # Create generative model with safety settings
        self.model = genai.GenerativeModel(
            model_name,
            safety_settings=safety_settings
        )

        logger.info(f"Gemini client initialized with model: {model_name}")

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
        prompt_parts = [self._build_interpretation_prompt(scenario_step, page_context)]
        
        if screenshot_base64:
            prompt_parts.append({
                "mime_type": "image/jpeg",
                "data": screenshot_base64
            })
            logger.info("Image data included in prompt")

        try:
            response = self.model.generate_content(prompt_parts)

            # Check if response was blocked
            if not response.candidates or not response.parts:
                logger.warning(f"Response blocked or empty. Prompt feedback: {response.prompt_feedback if hasattr(response, 'prompt_feedback') else 'N/A'}")

                # If screenshot was included, retry without it
                if screenshot_base64:
                    logger.info("Retrying without screenshot...")
                    prompt_parts_no_image = [self._build_interpretation_prompt(scenario_step, page_context)]
                    response = self.model.generate_content(prompt_parts_no_image)

                    if not response.candidates or not response.parts:
                        logger.error("Response still blocked after removing screenshot")
                        return {"action": "error", "message": "Gemini response was blocked by safety filters"}
                else:
                    return {"action": "error", "message": "Gemini response was blocked by safety filters"}

            result = self._parse_gemini_response(response.text)

            logger.info(f"Interpreted step: {scenario_step} -> {result}")
            return result

        except Exception as e:
            logger.error(f"Error interpreting scenario step: {e}")
            return {"action": "error", "message": str(e)}

    def _build_interpretation_prompt(
        self, scenario_step: str, page_context: str
    ) -> str:
        """Build prompt for Gemini to interpret scenario step.

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
{page_context[:2000]}  # Limit context to avoid token limits

【指示】
このステップを実行するために必要な操作を、以下のJSON形式で返してください：

{{
  "action": "click" | "fill" | "navigate" | "wait" | "extract",
  "selector": "CSS selector or description of element",
  "value": "value to input (for fill/wait actions)",
  "instruction": "extraction instruction (for extract actions)",
  "target": "daily_actuals | monthly_actuals (for extract actions)"
}}

例：
- "ログインボタンをクリック" → {{"action": "click", "selector": "button[type='submit']"}}
- "ユーザー名を入力" → {{"action": "fill", "selector": "input[name='username']", "value": "USERNAME_PLACEHOLDER"}}
- "待機 (3000ms)" → {{"action": "wait", "value": "3000"}}
- "テーブルから日別の確定報酬データを抽出して daily_actuals テーブルに保存" → {{
    "action": "extract",
    "selector": "table",
    "instruction": "テーブルから日別の確定報酬データ（日付と金額）を抽出してJSON形式で返す",
    "target": "daily_actuals"
  }}

必ずJSON形式のみを返してください。説明文は不要です。
"""

    def _parse_gemini_response(self, response_text: str) -> Dict[str, Any]:
        """Parse Gemini's response into structured command.

        Args:
            response_text: Raw response from Gemini

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
            logger.error(f"Failed to parse Gemini response as JSON: {e}")
            logger.error(f"Response text: {response_text}")
            return {"action": "error", "message": "Failed to parse response"}

    def extract_data_from_page(
        self, page_content: str, extraction_instruction: str
    ) -> Optional[str]:
        """Extract specific data from page content using Gemini.

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
            response = self.model.generate_content(prompt)
            extracted_data = response.text.strip()

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
