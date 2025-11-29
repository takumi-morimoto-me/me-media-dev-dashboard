"""Scraper healer that fixes broken scrapers using LLM."""

import logging
from pathlib import Path
from typing import Optional
import google.generativeai as genai

from .scraper_generator import ScraperGenerator

logger = logging.getLogger(__name__)


class ScraperHealer:
    """Heal broken scrapers by analyzing errors and generating fixes using LLM."""

    def __init__(self, api_key: str, model_name: str = "gemini-1.5-flash", scrapers_dir: Optional[Path] = None):
        """Initialize scraper healer.

        Args:
            api_key: Google API key for Gemini
            model_name: Model name (e.g., "gemini-2.0-flash-exp")
            scrapers_dir: Path to scrapers directory
        """
        self.api_key = api_key
        self.model_name = model_name
        self.scrapers_dir = scrapers_dir or Path(__file__).parent.parent / "scrapers"

        # Configure Gemini API
        genai.configure(api_key=api_key)
        
        # Configure safety settings
        safety_settings = [
            {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_NONE"},
            {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_NONE"},
            {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_NONE"},
            {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_NONE"}
        ]

        self.model = genai.GenerativeModel(model_name, safety_settings=safety_settings)
        logger.info(f"ScraperHealer initialized with model: {model_name}")

    def heal_scraper(
        self,
        asp_name: str,
        execution_type: str,
        error_message: str,
        script_output: str = "",
        screenshot_base64: Optional[str] = None
    ) -> bool:
        """Attempt to heal a broken scraper.

        Args:
            asp_name: Name of the ASP
            execution_type: Type of execution
            error_message: Error message from failed execution
            script_output: Output from the failed script
            screenshot_base64: Optional screenshot of the error state

        Returns:
            True if healing was successful, False otherwise
        """
        logger.info(f"Attempting to heal scraper: {asp_name}/{execution_type}")

        # Get current script
        script_path = self._get_script_path(asp_name, execution_type)
        if not script_path.exists():
            logger.error(f"Script not found: {script_path}")
            return False

        # Read current code
        with open(script_path, "r", encoding="utf-8") as f:
            current_code = f.read()

        # Build healing prompt
        prompt_parts = [self._build_healing_prompt(current_code, error_message, script_output)]
        
        if screenshot_base64:
            prompt_parts.append({
                "mime_type": "image/jpeg",
                "data": screenshot_base64
            })
            logger.info("Screenshot included in healing prompt")

        # Generate fix
        try:
            logger.info("Calling LLM to generate fix...")
            response = self.model.generate_content(prompt_parts)
            
            if not response.candidates or not response.parts:
                logger.error("LLM response was blocked or empty")
                return False

            fixed_code = self._extract_code_from_response(response.text)
            
            if not fixed_code:
                logger.error("Failed to extract code from LLM response")
                return False

            # Backup current version
            self._backup_script(asp_name, execution_type)

            # Save fixed version
            with open(script_path, "w", encoding="utf-8") as f:
                f.write(fixed_code)

            logger.info(f"Successfully healed scraper: {script_path}")
            return True

        except Exception as e:
            logger.error(f"Error healing scraper: {e}")
            return False

    def _build_healing_prompt(self, current_code: str, error_message: str, script_output: str) -> str:
        """Build prompt for LLM to fix the scraper.

        Args:
            current_code: Current scraper code
            error_message: Error message
            script_output: Output from failed script

        Returns:
            Formatted prompt string
        """
        prompt = f"""あなたはPythonとPlaywrightを使ったWebスクレイピングのエキスパートです。

以下のスクレイピングスクリプトがエラーで失敗しました。エラーを分析して、修正されたコードを生成してください。

【現在のコード】
```python
{current_code}
```

【エラーメッセージ】
{error_message}

【スクリプト出力】
{script_output}

【修正の指針】
1. エラーの原因を特定する
2. セレクタが間違っている場合は、より堅牢なセレクタに変更
3. タイムアウトが発生している場合は、待機時間を調整
4. 要素が見つからない場合は、代替セレクタを試す
5. データパースエラーの場合は、パースロジックを改善
6. エラーハンドリングを追加して、より詳細なログを出力

【重要な注意事項】
- 既存のコード構造を可能な限り維持する
- 新しい機能を追加するのではなく、エラーを修正することに集中
- 修正後のコードは完全に動作する必要がある

【出力形式】
修正されたPythonコードのみを出力してください。説明文は不要です。
コードは ```python ``` で囲んでください。
"""
        return prompt

    def _extract_code_from_response(self, response_text: str) -> Optional[str]:
        """Extract Python code from LLM response.

        Args:
            response_text: Raw response from LLM

        Returns:
            Extracted Python code or None
        """
        text = response_text.strip()
        
        # Remove markdown code blocks if present
        if "```python" in text:
            parts = text.split("```python")
            if len(parts) > 1:
                code = parts[1].split("```")[0].strip()
                return code
        elif "```" in text:
            parts = text.split("```")
            if len(parts) >= 3:
                code = parts[1].strip()
                # Remove language identifier if present
                if code.startswith("python\n"):
                    code = code[7:]
                return code
        
        # If no code blocks, assume entire response is code
        return text

    def _get_script_path(self, asp_name: str, execution_type: str) -> Path:
        """Get path to scraper script.

        Args:
            asp_name: Name of the ASP
            execution_type: Type of execution

        Returns:
            Path to script
        """
        return self.scrapers_dir / asp_name / f"{execution_type}.py"

    def _backup_script(self, asp_name: str, execution_type: str):
        """Create a backup of the current script.

        Args:
            asp_name: Name of the ASP
            execution_type: Type of execution
        """
        from datetime import datetime
        
        script_path = self._get_script_path(asp_name, execution_type)
        if not script_path.exists():
            return

        # Create backup with timestamp
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_path = script_path.parent / f"{execution_type}.backup_{timestamp}.py"

        with open(script_path, "r", encoding="utf-8") as f:
            code = f.read()

        with open(backup_path, "w", encoding="utf-8") as f:
            f.write(code)

        logger.info(f"Created backup: {backup_path}")
