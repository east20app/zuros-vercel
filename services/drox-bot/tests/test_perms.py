import asyncio
import importlib.util
import os
import sys
import types
import unittest
from pathlib import Path
from unittest.mock import patch


class FakeDatabase:
    config = {}

    @classmethod
    def obter(cls, _filename):
        return cls.config


fake_database_module = types.ModuleType("functions.database")
fake_database_module.database = FakeDatabase
sys.modules["functions.database"] = fake_database_module
spec = importlib.util.spec_from_file_location("permission_module", Path(__file__).parents[1] / "functions" / "perms.py")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class PermissionTests(unittest.TestCase):
    def test_environment_owner_overrides_stale_protected_config(self):
        FakeDatabase.config = {"bot": {"owner": "old-owner", "perms": []}}
        with patch.dict(os.environ, {"OWNER_ID": "current-owner"}, clear=True):
            self.assertTrue(asyncio.run(module.perms.check_owner("current-owner")))
            self.assertFalse(asyncio.run(module.perms.check_owner("old-owner")))
            self.assertTrue(asyncio.run(module.perms.check("current-owner")))

    def test_string_permissions_are_ids_not_characters(self):
        FakeDatabase.config = {"bot": {"owner": "owner", "perms": "123,456"}}
        with patch.dict(os.environ, {}, clear=True):
            self.assertTrue(asyncio.run(module.perms.check("123")))
            self.assertFalse(asyncio.run(module.perms.check("1")))

    def test_config_owner_is_fallback_without_environment(self):
        FakeDatabase.config = {"bot": {"owner": "owner", "perms": []}}
        with patch.dict(os.environ, {}, clear=True):
            self.assertTrue(asyncio.run(module.perms.check_owner("owner")))


if __name__ == "__main__":
    unittest.main()
