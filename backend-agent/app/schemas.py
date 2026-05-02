from typing import Literal

from pydantic import BaseModel, Field, field_validator


class HistoryTurn(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(..., min_length=1, max_length=32000)

    @field_validator("content")
    @classmethod
    def strip_content(cls, v: str) -> str:
        s = v.strip()
        if not s:
            raise ValueError("history content cannot be empty")
        return s


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=32000)
    history: list[HistoryTurn] | None = None

    @field_validator("message")
    @classmethod
    def strip_message(cls, v: str) -> str:
        s = v.strip()
        if not s:
            raise ValueError("message cannot be empty or whitespace only")
        return s


class ChatResponse(BaseModel):
    reply: str
    toolCalls: list[dict[str, str]] | None = None
