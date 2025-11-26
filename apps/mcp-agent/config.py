"""Application settings and configuration."""

import os
from dataclasses import dataclass
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()


@dataclass
class Settings:
    """Application settings loaded from environment variables."""

    # Supabase
    supabase_url: str
    supabase_service_role_key: str

    # Google Gemini API
    google_api_key: str
    gemini_model: str

    # Anthropic Claude API
    anthropic_api_key: str

    # Execution
    headless: bool
    log_level: str

    @classmethod
    def from_env(cls) -> "Settings":
        """Create Settings instance from environment variables."""
        return cls(
            # Supabase
            supabase_url=os.getenv("SUPABASE_URL", ""),
            supabase_service_role_key=os.getenv("SUPABASE_SERVICE_ROLE_KEY", ""),
            # Gemini API
            google_api_key=os.getenv("GOOGLE_API_KEY", ""),
            gemini_model=os.getenv("GEMINI_MODEL", "gemini-1.5-flash"),
            # Anthropic API
            anthropic_api_key=os.getenv("ANTHROPIC_API_KEY", ""),
            # Execution
            headless=os.getenv("HEADLESS", "true").lower() == "true",
            log_level=os.getenv("LOG_LEVEL", "INFO"),
        )

    def validate(self) -> None:
        """Validate required settings."""
        required_fields = [
            ("SUPABASE_URL", self.supabase_url),
            ("SUPABASE_SERVICE_ROLE_KEY", self.supabase_service_role_key),
            ("ANTHROPIC_API_KEY", self.anthropic_api_key),
        ]

        missing = [name for name, value in required_fields if not value]

        if missing:
            raise ValueError(
                f"Missing required environment variables: {', '.join(missing)}"
            )
