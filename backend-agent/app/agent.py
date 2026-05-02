"""LangChain agent (Gemini) with weather tools backed by mcp-wrapper."""

from __future__ import annotations

import logging
import os
from typing import Any

from langchain.agents import create_agent
from langchain_core.messages import AIMessage, BaseMessage, HumanMessage, ToolMessage
from langchain_google_genai import ChatGoogleGenerativeAI

from app.tools import build_weather_tools

logger = logging.getLogger("backend-agent.agent")

SYSTEM_PROMPT = """You are a concise weather assistant.

- Answer only using the weather tools when the user needs current conditions, a forecast, or air quality.
- For non-weather small talk or unrelated questions: reply in one or two short sentences without using tools; do not elaborate.
- When a tool returns JSON, summarize clearly for the user (imperial units where applicable).
- If a tool message starts with "Error:", follow that guidance in your reply to the user."""

DEFAULT_MODEL = "gemini-2.5-flash-lite"

def _resolve_gemini_api_key() -> str:
    return (
        os.getenv("GEMINI_API_KEY", "").strip()
        or os.getenv("GOOGLE_API_KEY", "").strip()
    )


def _resolve_wrapper_url() -> str:
    return (os.getenv("MCP_WRAPPER_URL") or "").strip()


def assert_gemini_configured() -> None:
    if not _resolve_gemini_api_key():
        raise RuntimeError("GEMINI_API_KEY is not set; refusing to start.")


def create_weather_agent():
    """Build the compiled LangGraph agent (call once at startup)."""
    api_key = _resolve_gemini_api_key()
    wrapper_url = _resolve_wrapper_url()
    if not wrapper_url:
        raise RuntimeError("MCP_WRAPPER_URL is not set; refusing to start.")
    logger.info("************************************************************")
    logger.info("GEMINI_MODEL: %s", os.getenv("GEMINI_MODEL"))    
    logger.info("************************************************************")
    model_name = os.getenv("GEMINI_MODEL", DEFAULT_MODEL).strip() or DEFAULT_MODEL
    model = ChatGoogleGenerativeAI(
        model=model_name,
        api_key=api_key,
    )
    tools = build_weather_tools(wrapper_url)
    agent = create_agent(
        model,
        tools=tools,
        system_prompt=SYSTEM_PROMPT,
        name="weather-agent",
    )
    logger.info("weather agent compiled model=%s tools=%d", model_name, len(tools))
    return agent


def _history_to_messages(history: list[Any]) -> list[BaseMessage]:
    out: list[BaseMessage] = []
    for turn in history:
        role = turn.role
        content = turn.content.strip()
        if role == "user":
            out.append(HumanMessage(content=content))
        else:
            out.append(AIMessage(content=content))
    return out


def _final_text_from_result(result: dict[str, Any]) -> str:
    messages = result.get("messages") or []
    for msg in reversed(messages):
        if isinstance(msg, AIMessage):
            content = msg.content
            if isinstance(content, str):
                return content.strip() or "(no reply)"
            if isinstance(content, list):
                parts: list[str] = []
                for block in content:
                    if isinstance(block, dict) and block.get("type") == "text":
                        parts.append(str(block.get("text", "")))
                    elif isinstance(block, str):
                        parts.append(block)
                text = "".join(parts).strip()
                return text or "(no reply)"
            return str(content)
    return "(no reply)"


def _tool_call_entry_name(entry: Any) -> str | None:
    if isinstance(entry, dict):
        raw = entry.get("name")
        return raw.strip() if isinstance(raw, str) and raw.strip() else None
    raw = getattr(entry, "name", None)
    return raw.strip() if isinstance(raw, str) and raw.strip() else None


def _tool_names_from_result(result: dict[str, Any]) -> list[str]:
    """Collect tool names from AIMessage.tool_calls (LangGraph agent standard).

    ToolMessage often does not carry a separate ``name`` field; the model requests
    tools via AIMessage.tool_calls which includes the tool name.
    """
    names: list[str] = []
    messages = result.get("messages") or []
    for msg in messages:
        if isinstance(msg, AIMessage) and getattr(msg, "tool_calls", None):
            for tc in msg.tool_calls or []:
                n = _tool_call_entry_name(tc)
                if n:
                    names.append(n)

    # Fallback: some stacks still attach name on ToolMessage.
    for msg in messages:
        if isinstance(msg, ToolMessage):
            n = getattr(msg, "name", None)
            if isinstance(n, str) and n.strip():
                names.append(n.strip())

    # Preserve order while de-duplicating.
    deduped: list[str] = []
    seen: set[str] = set()
    for name in names:
        if name in seen:
            continue
        seen.add(name)
        deduped.append(name)
    return deduped


async def run_chat(
    agent: Any, *, user_message: str, history: list[Any] | None
) -> tuple[str, list[str]]:
    msgs: list[BaseMessage] = []
    if history:
        msgs.extend(_history_to_messages(history))
    msgs.append(HumanMessage(content=user_message.strip()))

    result = await agent.ainvoke({"messages": msgs})
    return _final_text_from_result(result), _tool_names_from_result(result)
