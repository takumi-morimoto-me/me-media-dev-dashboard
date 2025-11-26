"""Scenario loader for YAML-based ASP scenarios."""

import os
import json
import logging
from pathlib import Path
from typing import Dict, List, Optional, Any
import yaml

logger = logging.getLogger(__name__)

# Scenarios directory path
SCENARIOS_DIR = Path(__file__).parent.parent / "scenarios"


class ScenarioLoader:
    """Load and manage ASP scenarios from YAML files."""

    def __init__(self, scenarios_dir: Optional[Path] = None):
        """Initialize scenario loader.

        Args:
            scenarios_dir: Path to scenarios directory. Defaults to ./scenarios/
        """
        self.scenarios_dir = scenarios_dir or SCENARIOS_DIR
        self._scenarios_cache: Dict[str, Dict] = {}

    def load_scenario(self, asp_name: str) -> Optional[Dict]:
        """Load scenario for a specific ASP.

        Args:
            asp_name: Name of the ASP (e.g., 'afb', 'a8net')

        Returns:
            Scenario dictionary or None if not found
        """
        # Check cache first
        if asp_name in self._scenarios_cache:
            return self._scenarios_cache[asp_name]

        # Try to load from file
        yaml_path = self.scenarios_dir / f"{asp_name}.yaml"
        if not yaml_path.exists():
            # Try alternative names
            yaml_path = self.scenarios_dir / f"{asp_name.lower()}.yaml"

        if not yaml_path.exists():
            logger.warning(f"Scenario file not found: {yaml_path}")
            return None

        try:
            with open(yaml_path, "r", encoding="utf-8") as f:
                scenario = yaml.safe_load(f)
                self._scenarios_cache[asp_name] = scenario
                logger.info(f"Loaded scenario from {yaml_path}")
                return scenario
        except Exception as e:
            logger.error(f"Failed to load scenario from {yaml_path}: {e}")
            return None

    def list_scenarios(self) -> List[str]:
        """List all available scenario names.

        Returns:
            List of ASP names with available scenarios
        """
        scenarios = []
        if not self.scenarios_dir.exists():
            return scenarios

        for yaml_file in self.scenarios_dir.glob("*.yaml"):
            scenarios.append(yaml_file.stem)

        return sorted(scenarios)

    def get_actions(
        self, asp_name: str, execution_type: str = "daily"
    ) -> Optional[List[Dict]]:
        """Get actions for a specific execution type.

        Args:
            asp_name: Name of the ASP
            execution_type: Type of execution ('daily', 'monthly')

        Returns:
            List of action dictionaries or None
        """
        scenario = self.load_scenario(asp_name)
        if not scenario:
            return None

        type_config = scenario.get(execution_type)
        if not type_config:
            logger.warning(f"No {execution_type} scenario defined for {asp_name}")
            return None

        return type_config.get("actions", [])

    def get_retry_config(self, asp_name: str) -> Dict[str, Any]:
        """Get retry configuration for an ASP.

        Args:
            asp_name: Name of the ASP

        Returns:
            Retry configuration dictionary with defaults
        """
        default_config = {
            "max_attempts": 3,
            "delay_ms": 2000,
            "retry_on": ["timeout", "element_not_found"],
        }

        scenario = self.load_scenario(asp_name)
        if not scenario:
            return default_config

        return scenario.get("retry", default_config)

    def to_json_actions(
        self, asp_name: str, execution_type: str = "daily"
    ) -> Optional[str]:
        """Convert scenario actions to JSON string for DB storage.

        Args:
            asp_name: Name of the ASP
            execution_type: Type of execution

        Returns:
            JSON string of actions or None
        """
        actions = self.get_actions(asp_name, execution_type)
        if not actions:
            return None

        return json.dumps(actions, ensure_ascii=False, indent=2)

    def sync_to_database(self, supabase_client, asp_name: str = None) -> Dict[str, bool]:
        """Sync scenarios from YAML files to Supabase database.

        Args:
            supabase_client: Supabase client instance
            asp_name: Optional specific ASP to sync. If None, syncs all.

        Returns:
            Dictionary mapping ASP names to sync success status
        """
        results = {}

        if asp_name:
            asp_names = [asp_name]
        else:
            asp_names = self.list_scenarios()

        for name in asp_names:
            scenario = self.load_scenario(name)
            if not scenario:
                results[name] = False
                continue

            try:
                # Get DB name from scenario or use display_name
                db_asp_name = scenario.get("asp_name_in_db") or scenario.get(
                    "display_name", name
                )

                # Get actions for the preferred execution type (daily or monthly)
                actions = self.get_actions(name, "daily")
                if not actions:
                    actions = self.get_actions(name, "monthly")

                if not actions:
                    logger.warning(f"No actions found for {name}")
                    results[name] = False
                    continue

                # Convert to JSON
                actions_json = json.dumps(actions, ensure_ascii=False, indent=2)

                # Update database
                result = supabase_client.client.table("asps").update(
                    {"prompt": actions_json}
                ).eq("name", db_asp_name).execute()

                if result.data:
                    logger.info(f"Synced {name} to database as '{db_asp_name}'")
                    results[name] = True
                else:
                    logger.warning(f"No matching ASP found in DB for: {db_asp_name}")
                    results[name] = False

            except Exception as e:
                logger.error(f"Failed to sync {name}: {e}")
                results[name] = False

        return results


# Singleton instance for convenience
_loader: Optional[ScenarioLoader] = None


def get_scenario_loader() -> ScenarioLoader:
    """Get singleton scenario loader instance."""
    global _loader
    if _loader is None:
        _loader = ScenarioLoader()
    return _loader
