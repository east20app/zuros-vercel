from functools import lru_cache

from pydantic import Field, HttpUrl, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore", str_strip_whitespace=True)

    discord_token: SecretStr
    discord_application_id: int | None = None
    discord_guild_id: int | None = None
    zuros_api_base_url: HttpUrl = HttpUrl("https://app.zuros.site")
    zuros_client_bot_id: str = Field(min_length=1)
    zuros_client_bot_secret: SecretStr = Field(min_length=32)
    zuros_dashboard_url: HttpUrl = HttpUrl("https://app.zuros.site/dashboard")
    zuros_plans_url: HttpUrl = HttpUrl("https://app.zuros.site/planos")
    zuros_support_url: HttpUrl = HttpUrl("https://discord.gg/zuros")
    http_timeout_seconds: float = Field(default=20, ge=3, le=60)
    log_level: str = "INFO"

    @property
    def api_root(self) -> str:
        return f"{str(self.zuros_api_base_url).rstrip('/')}/api/client-bot/v1"


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
