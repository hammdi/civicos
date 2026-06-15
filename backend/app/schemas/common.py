"""Shared schema building blocks."""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict


class ORMModel(BaseModel):
    """Base for response models that read straight off SQLAlchemy objects."""

    model_config = ConfigDict(from_attributes=True)


class Message(BaseModel):
    message: str


class HealthResponse(BaseModel):
    status: str
    app: str
    version: str
    modules: list[str]
