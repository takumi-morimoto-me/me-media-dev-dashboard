"""Notification system for sending alerts about scraper execution."""

import logging
from typing import Optional, Dict, Any
import os
import requests

logger = logging.getLogger(__name__)


class Notifier:
    """Handles notifications for scraper execution results."""

    def __init__(self, slack_webhook_url: Optional[str] = None):
        """Initialize notifier.

        Args:
            slack_webhook_url: Slack webhook URL for notifications
        """
        self.slack_webhook_url = slack_webhook_url or os.getenv("SLACK_WEBHOOK_URL")

    def send_execution_summary(
        self, results: Dict[str, bool], execution_type: str = "manual"
    ) -> None:
        """Send execution summary notification.

        Args:
            results: Dictionary mapping ASP names to success status
            execution_type: Type of execution ('daily', 'monthly', 'manual')
        """
        successful = sum(1 for success in results.values() if success)
        total = len(results)
        failed = total - successful

        # Prepare failed ASPs list
        failed_asps = [name for name, success in results.items() if not success]

        message = self._format_summary_message(
            execution_type=execution_type,
            total=total,
            successful=successful,
            failed=failed,
            failed_asps=failed_asps,
        )

        # Send to Slack if webhook is configured
        if self.slack_webhook_url:
            self._send_slack_message(message, is_error=(failed > 0))
        else:
            logger.info(f"No Slack webhook configured, skipping notification")
            logger.info(f"Summary: {message}")

    def send_error_notification(
        self, asp_name: str, error_message: str, execution_type: str = "manual"
    ) -> None:
        """Send error notification for a specific ASP.

        Args:
            asp_name: Name of the ASP that failed
            error_message: Error message details
            execution_type: Type of execution ('daily', 'monthly', 'manual')
        """
        message = self._format_error_message(
            asp_name=asp_name,
            error_message=error_message,
            execution_type=execution_type,
        )

        if self.slack_webhook_url:
            self._send_slack_message(message, is_error=True)
        else:
            logger.error(f"Error notification: {message}")

    def _format_summary_message(
        self,
        execution_type: str,
        total: int,
        successful: int,
        failed: int,
        failed_asps: list[str],
    ) -> str:
        """Format execution summary message.

        Args:
            execution_type: Type of execution
            total: Total number of ASPs
            successful: Number of successful executions
            failed: Number of failed executions
            failed_asps: List of failed ASP names

        Returns:
            Formatted message string
        """
        import datetime

        execution_type_map = {
            "daily": "日次データ取得",
            "monthly": "月次データ取得",
            "manual": "手動実行",
        }

        status_emoji = "✅" if failed == 0 else "⚠️" if failed < total / 2 else "❌"

        message = f"""{status_emoji} **ASPデータ取得完了**

📅 実行日時: {datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")}
📊 実行タイプ: {execution_type_map.get(execution_type, execution_type)}
🎯 対象ASP: {total}件

**結果サマリー**
✅ 成功: {successful}件
❌ 失敗: {failed}件"""

        if failed_asps:
            message += f"\n\n**失敗したASP:**\n" + "\n".join(
                f"• {asp}" for asp in failed_asps
            )

        return message

    def _format_error_message(
        self, asp_name: str, error_message: str, execution_type: str
    ) -> str:
        """Format error message.

        Args:
            asp_name: Name of the ASP
            error_message: Error message
            execution_type: Type of execution

        Returns:
            Formatted error message
        """
        import datetime

        execution_type_map = {
            "daily": "日次データ取得",
            "monthly": "月次データ取得",
            "manual": "手動実行",
        }

        return f"""❌ **ASPデータ取得エラー**

📅 実行日時: {datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")}
🏢 ASP名: {asp_name}
📊 実行タイプ: {execution_type_map.get(execution_type, execution_type)}

**エラー詳細:**
```
{error_message}
```

ダッシュボードから手動で再実行してください。"""

    def _send_slack_message(self, message: str, is_error: bool = False) -> bool:
        """Send message to Slack.

        Args:
            message: Message to send
            is_error: Whether this is an error message

        Returns:
            True if successful, False otherwise
        """
        if not self.slack_webhook_url:
            return False

        try:
            payload = {
                "text": message,
                "mrkdwn": True,
            }

            if is_error:
                payload["attachments"] = [
                    {
                        "color": "danger",
                        "text": message,
                    }
                ]

            response = requests.post(
                self.slack_webhook_url,
                json=payload,
                timeout=10,
            )

            if response.status_code == 200:
                logger.info("Slack notification sent successfully")
                return True
            else:
                logger.error(
                    f"Failed to send Slack notification: {response.status_code}"
                )
                return False

        except Exception as e:
            logger.error(f"Error sending Slack notification: {e}")
            return False
