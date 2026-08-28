import importlib.util
import os
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

spec = importlib.util.spec_from_file_location(
    "zuros_client", Path(__file__).parents[1] / "modules" / "cloud" / "zuros_client.py"
)
module = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = module
spec.loader.exec_module(module)
ZurosSettings = module.ZurosSettings
ZurosConfigurationError = module.ZurosConfigurationError


class ZurosSettingsTests(unittest.TestCase):
    def test_reads_documented_environment(self):
        env = {
            "ZUROS_BACKEND_URL": "https://example.test/",
            "ZUROS_AUTH_ID": "auth",
            "ZUROS_BOT_CREDENTIAL": "secret",
            "BOT_GATEWAY_SHARED_SECRET": "gateway",
        }
        with patch.dict(os.environ, env, clear=True):
            settings = ZurosSettings.from_env()
        self.assertEqual(settings.backend_url, "https://example.test")
        self.assertTrue(settings.configured)
        self.assertEqual(settings.gateway_secret, "gateway")

    def test_missing_secret_is_rejected(self):
        with self.assertRaises(ZurosConfigurationError):
            ZurosSettings("https://example.test", "auth", "").validate()

    def test_configured_requires_both_credentials(self):
        self.assertFalse(ZurosSettings("https://example.test", "auth", "").configured)


if __name__ == "__main__":
    unittest.main()
