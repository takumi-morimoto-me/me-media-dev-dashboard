"""Scraper generator that creates Python scripts from YAML scenarios using LLM."""

import logging
import json
import hashlib
from pathlib import Path
from typing import Dict, Any, Optional
from datetime import datetime
import google.generativeai as genai

from .scenario_loader import get_scenario_loader

logger = logging.getLogger(__name__)


class ScraperGenerator:
    """Generate Python scraper scripts from YAML scenarios using LLM."""

    def __init__(self, api_key: str, model_name: str = "gemini-1.5-flash", scrapers_dir: Optional[Path] = None):
        """Initialize scraper generator.

        Args:
            api_key: Google API key for Gemini
            model_name: Model name (e.g., "gemini-1.5-flash-latest")
            scrapers_dir: Path to scrapers directory. Defaults to ./scrapers/
        """
        self.api_key = api_key
        # Use latest version for better compatibility
        if model_name == "gemini-1.5-flash":
            model_name = "gemini-1.5-flash-latest"
        self.model_name = model_name
        self.scrapers_dir = scrapers_dir or Path(__file__).parent.parent / "scrapers"
        self.scenario_loader = get_scenario_loader()

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
        logger.info(f"ScraperGenerator initialized with model: {model_name}")

    def generate_scraper(self, asp_name: str, execution_type: str = "daily", force: bool = False) -> Optional[Path]:
        """Generate a Python scraper script from YAML scenario.

        Args:
            asp_name: Name of the ASP (e.g., 'a8net', 'afb')
            execution_type: Type of execution ('daily', 'monthly')
            force: Force regeneration even if script already exists

        Returns:
            Path to generated script or None if generation failed
        """
        logger.info(f"Generating scraper for {asp_name}/{execution_type}")

        # Load scenario from YAML
        scenario = self.scenario_loader.load_scenario(asp_name)
        if not scenario:
            logger.error(f"No scenario found for {asp_name}")
            return None

        # Check if script already exists
        script_path = self._get_script_path(asp_name, execution_type)
        metadata_path = self._get_metadata_path(asp_name)
        
        if script_path.exists() and not force:
            # Check if YAML has changed
            yaml_hash = self._calculate_yaml_hash(scenario, execution_type)
            metadata = self._load_metadata(asp_name)
            
            if metadata and metadata.get(execution_type, {}).get("yaml_hash") == yaml_hash:
                logger.info(f"Script already exists and YAML unchanged: {script_path}")
                return script_path
            else:
                logger.info(f"YAML has changed, regenerating script")

        # Get execution type config
        type_config = scenario.get(execution_type)
        if not type_config:
            logger.error(f"No {execution_type} configuration found for {asp_name}")
            return None

        # Build generation prompt
        prompt = self._build_generation_prompt(scenario, execution_type, type_config)

        # Generate code using LLM
        try:
            logger.info("Calling LLM to generate scraper code...")
            response = self.model.generate_content(prompt)
            
            if not response.candidates or not response.parts:
                logger.error("LLM response was blocked or empty")
                return None

            generated_code = self._extract_code_from_response(response.text)
            
            if not generated_code:
                logger.error("Failed to extract code from LLM response")
                return None

            # Validate generated code
            if not self._validate_generated_code(generated_code):
                logger.error("Generated code failed validation")
                return None

            # Save scraper
            saved_path = self._save_scraper(asp_name, execution_type, generated_code, scenario)
            logger.info(f"Successfully generated scraper: {saved_path}")
            
            return saved_path

        except Exception as e:
            logger.error(f"Error generating scraper: {e}")
            return None

    def _build_generation_prompt(self, scenario: Dict, execution_type: str, type_config: Dict) -> str:
        """Build prompt for LLM to generate scraper code.

        Args:
            scenario: Full scenario dictionary
            execution_type: Type of execution
            type_config: Configuration for this execution type

        Returns:
            Formatted prompt string
        """
        asp_name = scenario.get("display_name", scenario.get("name", "Unknown"))
        db_asp_name = scenario.get("asp_name_in_db", asp_name)
        actions = type_config.get("actions", [])
        description = type_config.get("description", "")
        credentials = scenario.get("credentials", {})

        prompt = f"""あなたはPythonとPlaywrightを使ったWebスクレイピングのエキスパートです。

以下のYAMLシナリオ定義に基づいて、完全に動作するPythonスクレイピングスクリプトを生成してください。

【ASP情報】
- ASP名: {asp_name}
- DB名: {db_asp_name}
- 実行タイプ: {execution_type}
- 説明: {description}

【認証情報】
{json.dumps(credentials, ensure_ascii=False, indent=2)}

【アクション定義】
{json.dumps(actions, ensure_ascii=False, indent=2)}

【要件】
1. Playwright (sync_api) を使用してブラウザ操作を実装
2. Supabase クライアントを使用してデータベースに保存
3. 環境変数から認証情報とSupabase接続情報を取得
4. エラーハンドリングを適切に実装
5. ログ出力を適切に実装
6. run_scraper() 関数を実装し、以下の形式で結果を返す:
   {{"success": True/False, "records_saved": int, "error": str (optional)}}
7. if __name__ == "__main__": ブロックで run_scraper() を実行

【データベーススキーマ】
- daily_actuals テーブル: date (DATE), amount (INTEGER), media_id (UUID), asp_id (UUID), account_item_id (UUID)
- actuals テーブル (月次): period (TEXT, YYYY-MM形式), amount (INTEGER), media_id (UUID), asp_id (UUID), account_item_id (UUID)

【環境変数】
- SUPABASE_URL: Supabase URL
- SUPABASE_SERVICE_ROLE_KEY: Supabase サービスロールキー
- {credentials.get('username_key', 'USERNAME')}: ログインユーザー名
- {credentials.get('password_key', 'PASSWORD')}: ログインパスワード

【重要な注意事項】
- ASP IDとMedia IDは実行時にデータベースから取得すること
- 既存データは削除してから新規データを挿入すること
- 金額のパースは、カンマや円記号を除去して整数に変換すること
- 日付のパースは YYYY-MM-DD 形式に統一すること
- headless=True でブラウザを起動すること (本番環境用)
- スクリーンショットは不要

【出力形式】
Pythonコードのみを出力してください。説明文やマークダウンは不要です。
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

    def _validate_generated_code(self, code: str) -> bool:
        """Validate generated Python code.

        Args:
            code: Generated Python code

        Returns:
            True if valid, False otherwise
        """
        # Basic validation: check for required imports and function
        required_elements = [
            "from playwright.sync_api import sync_playwright",
            "from supabase import create_client",
            "def run_scraper(",
            "if __name__ == \"__main__\":"
        ]

        for element in required_elements:
            if element not in code:
                logger.error(f"Generated code missing required element: {element}")
                return False

        # Try to compile the code
        try:
            compile(code, "<generated>", "exec")
            return True
        except SyntaxError as e:
            logger.error(f"Generated code has syntax error: {e}")
            return False

    def _save_scraper(self, asp_name: str, execution_type: str, code: str, scenario: Dict) -> Path:
        """Save generated scraper to file.

        Args:
            asp_name: Name of the ASP
            execution_type: Type of execution
            code: Generated Python code
            scenario: Original scenario dictionary

        Returns:
            Path to saved script
        """
        # Create ASP directory
        asp_dir = self.scrapers_dir / asp_name
        asp_dir.mkdir(parents=True, exist_ok=True)

        # Save script
        script_path = asp_dir / f"{execution_type}.py"
        with open(script_path, "w", encoding="utf-8") as f:
            f.write(code)

        logger.info(f"Saved scraper to {script_path}")

        # Update metadata
        self._update_metadata(asp_name, execution_type, scenario)

        return script_path

    def _get_script_path(self, asp_name: str, execution_type: str) -> Path:
        """Get path to scraper script.

        Args:
            asp_name: Name of the ASP
            execution_type: Type of execution

        Returns:
            Path to script
        """
        return self.scrapers_dir / asp_name / f"{execution_type}.py"

    def _get_metadata_path(self, asp_name: str) -> Path:
        """Get path to metadata file.

        Args:
            asp_name: Name of the ASP

        Returns:
            Path to metadata file
        """
        return self.scrapers_dir / asp_name / "metadata.json"

    def _calculate_yaml_hash(self, scenario: Dict, execution_type: str) -> str:
        """Calculate hash of YAML scenario for change detection.

        Args:
            scenario: Scenario dictionary
            execution_type: Type of execution

        Returns:
            SHA256 hash of relevant scenario data
        """
        # Extract relevant data for hashing
        type_config = scenario.get(execution_type, {})
        hash_data = {
            "actions": type_config.get("actions", []),
            "credentials": scenario.get("credentials", {}),
            "asp_name_in_db": scenario.get("asp_name_in_db", "")
        }
        
        hash_str = json.dumps(hash_data, sort_keys=True, ensure_ascii=False)
        return hashlib.sha256(hash_str.encode()).hexdigest()

    def _load_metadata(self, asp_name: str) -> Optional[Dict]:
        """Load metadata for an ASP.

        Args:
            asp_name: Name of the ASP

        Returns:
            Metadata dictionary or None
        """
        metadata_path = self._get_metadata_path(asp_name)
        if not metadata_path.exists():
            return None

        try:
            with open(metadata_path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            logger.error(f"Failed to load metadata: {e}")
            return None

    def _update_metadata(self, asp_name: str, execution_type: str, scenario: Dict):
        """Update metadata file.

        Args:
            asp_name: Name of the ASP
            execution_type: Type of execution
            scenario: Original scenario dictionary
        """
        metadata_path = self._get_metadata_path(asp_name)
        
        # Load existing metadata or create new
        metadata = self._load_metadata(asp_name) or {}

        # Update metadata for this execution type
        metadata[execution_type] = {
            "generated_at": datetime.now().isoformat(),
            "yaml_hash": self._calculate_yaml_hash(scenario, execution_type),
            "model": self.model_name
        }

        # Save metadata
        with open(metadata_path, "w", encoding="utf-8") as f:
            json.dump(metadata, f, indent=2, ensure_ascii=False)

        logger.info(f"Updated metadata: {metadata_path}")
