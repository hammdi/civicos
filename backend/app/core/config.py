"""Centralised application configuration.

Every value can be overridden with an environment variable, which keeps the
platform portable: any city or country deploys the same image and only changes
the environment. Sensible development defaults let it boot with zero config.
"""

from __future__ import annotations

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # --- Identity -----------------------------------------------------------
    app_name: str = "CivicOS"
    environment: str = "development"  # development | production
    api_v1_prefix: str = ""  # spec uses root-level paths (e.g. /institutions)

    # --- Database -----------------------------------------------------------
    database_url: str = "postgresql+psycopg2://civicos:civicos@postgres:5432/civicos"

    # --- Redis (OTP store + websocket fan-out, optional) --------------------
    redis_url: str = "redis://redis:6379/0"

    # --- Auth ---------------------------------------------------------------
    jwt_secret: str = "change-me-in-production-please-use-a-long-random-string"
    jwt_algorithm: str = "HS256"
    jwt_expire_days: int = 30
    otp_expire_minutes: int = 5
    otp_length: int = 6
    # In development we expose the OTP in the API response so testers do not
    # need to read server logs. Always keep this False in production.
    otp_debug_return: bool = True

    # --- Notifications (Twilio is optional / lazy-loaded) -------------------
    twilio_account_sid: str | None = None
    twilio_auth_token: str | None = None
    twilio_from_number: str | None = None

    # --- Ecosystem integrations --------------------------------------------
    # StateSync = national e-gov identity backbone (verify national ID / docs).
    # IslamicFinanceOS = payment & settlement layer (wallet, zakat).
    # From inside Docker, host services are reached via host.docker.internal.
    statesync_base_url: str = "http://host.docker.internal:8080"
    statesync_enabled: bool = True
    ifos_base_url: str = "http://host.docker.internal:8000"
    ifos_enabled: bool = True
    # Where civic fees are collected (an IFOS wallet email). Per-institution
    # payees override this in the DB; this is the platform default.
    ifos_payee_email: str = "treasury@civicos.gov"
    ecosystem_timeout_seconds: float = 6.0

    # --- CORS ---------------------------------------------------------------
    cors_origins: str = "*"  # comma separated, or * for any

    @property
    def is_production(self) -> bool:
        return self.environment.lower() == "production"

    @property
    def cors_origin_list(self) -> list[str]:
        if self.cors_origins.strip() == "*":
            return ["*"]
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
