"""Supabase client for database operations."""

import logging
from typing import Optional, Dict, Any, List
from supabase import create_client, Client

logger = logging.getLogger(__name__)


class SupabaseClient:
    """Client for interacting with Supabase database."""

    def __init__(self, url: str, service_role_key: str):
        """Initialize Supabase client.

        Args:
            url: Supabase project URL
            service_role_key: Service role key for admin access
        """
        self.client: Client = create_client(url, service_role_key)
        logger.info("Supabase client initialized")

    def get_asp_scenario(self, asp_name: str) -> Optional[Dict[str, Any]]:
        """Get ASP scenario (prompt) from database.

        Args:
            asp_name: Name of the ASP

        Returns:
            ASP data including scenario, or None if not found
        """
        try:
            response = (
                self.client.table("asps")
                .select("*")
                .eq("name", asp_name)
                .single()
                .execute()
            )

            if response.data:
                logger.info(f"Retrieved scenario for ASP: {asp_name}")
                return response.data
            else:
                logger.warning(f"No scenario found for ASP: {asp_name}")
                return None

        except Exception as e:
            logger.error(f"Error retrieving ASP scenario: {e}")
            return None

    def get_all_asps(self) -> List[Dict[str, Any]]:
        """Get all ASPs that have scenarios defined.

        Returns:
            List of ASP data dictionaries
        """
        try:
            response = (
                self.client.table("asps")
                .select("*")
                .not_.is_("prompt", "null")
                .execute()
            )

            logger.info(f"Retrieved {len(response.data)} ASPs with scenarios")
            return response.data

        except Exception as e:
            logger.error(f"Error retrieving ASPs: {e}")
            return []

    def save_daily_actual(
        self,
        date: str,
        amount: float,
        media_id: str,
        account_item_id: str,
        asp_id: str,
    ) -> bool:
        """Save daily actual data to database.

        Args:
            date: Date in YYYY-MM-DD format
            amount: Amount value
            media_id: Media UUID
            account_item_id: Account item UUID
            asp_id: ASP UUID

        Returns:
            True if successful, False otherwise
        """
        try:
            data = {
                "date": date,
                "amount": amount,
                "media_id": media_id,
                "account_item_id": account_item_id,
                "asp_id": asp_id,
            }

            response = self.client.table("daily_actuals").upsert(
                data,
                on_conflict="date,media_id,account_item_id,asp_id"
            ).execute()

            logger.info(f"Saved daily actual for {date}: {amount}")
            return True

        except Exception as e:
            logger.error(f"Error saving daily actual: {e}")
            return False

    def save_monthly_actual(
        self,
        date: str,  # Should be end of month date (e.g., "2025-01-31")
        amount: float,
        media_id: str,
        account_item_id: str,
        asp_id: str,
    ) -> bool:
        """Save monthly actual data to database.

        Args:
            date: End of month date in YYYY-MM-DD format (e.g., "2025-01-31")
            amount: Amount value
            media_id: Media UUID
            account_item_id: Account item UUID
            asp_id: ASP UUID

        Returns:
            True if successful, False otherwise
        """
        try:
            data = {
                "date": date,
                "amount": amount,
                "media_id": media_id,
                "account_item_id": account_item_id,
                "asp_id": asp_id,
            }

            response = self.client.table("actuals").upsert(
                data,
                on_conflict="date,media_id,account_item_id,asp_id"
            ).execute()

            logger.info(f"Saved monthly actual for {date}: {amount}")
            return True

        except Exception as e:
            logger.error(f"Error saving monthly actual: {e}")
            return False
