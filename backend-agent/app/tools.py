"""LangChain tools that call the mcp-wrapper OpenWeather REST service."""

from __future__ import annotations

import json
import logging
from typing import Any

import httpx
from langchain_core.tools import tool

logger = logging.getLogger("backend-agent.tools")

REQUEST_TIMEOUT = httpx.Timeout(15.0, connect=5.0)


def _sanitize_url_for_logs(url: str) -> str:
    """Avoid logging query strings that may echo user city input at full length."""
    if "?" in url:
        return url.split("?", 1)[0] + "?…"
    return url


def _call_weather_endpoint(
    method: str,
    path: str,
    *,
    base_url: str,
    params: dict[str, Any],
) -> str:
    url = f"{base_url.rstrip('/')}{path}"
    try:
        with httpx.Client(timeout=REQUEST_TIMEOUT) as client:
            response = client.request(method, url, params=params)
    except httpx.TimeoutException:
        logger.warning("weather_client_timeout path=%s", path)
        return (
            "Error: The weather service did not respond in time. "
            "Ask the user to try again shortly."
        )
    except httpx.RequestError as exc:
        logger.error("weather_client_request_error path=%s err=%s", path, type(exc).__name__)
        return (
            "Error: Could not reach the weather service. "
            "Ask the user to try again later."
        )

    if response.status_code in (303, 404):
        logger.info(
            "weather_city_not_found path=%s status=%s",
            _sanitize_url_for_logs(str(response.request.url)),
            response.status_code,
        )
        try:
            body = response.json()
            detail = body.get("error", body.get("message", ""))
        except Exception:
            detail = ""
        suffix = f" ({detail})" if detail else ""
        return (
            f"Error: City not found{suffix}. "
            "Tell the user: no city was found—please check spelling, try a nearby "
            "major city, or suggest they try the region or country name if ambiguous."
        )

    if response.status_code == 400:
        logger.warning("weather_bad_request path=%s", path)
        try:
            body = response.json()
            detail = body.get("error", response.text[:200])
        except Exception:
            detail = response.text[:200]
        return f"Error: Invalid weather request ({detail}). Do not guess a city; ask the user to clarify."

    if response.status_code >= 500:
        logger.error(
            "weather_upstream_5xx path=%s status=%s",
            path,
            response.status_code,
        )
        return (
            "Error: The weather data provider is temporarily unavailable. "
            "Apologize briefly and ask the user to try again later."
        )

    if response.status_code != 200:
        logger.warning("weather_unexpected_status path=%s status=%s", path, response.status_code)
        return "Error: Unexpected response from weather service. Ask the user to try again."

    try:
        data = response.json()
    except json.JSONDecodeError:
        logger.error("weather_invalid_json path=%s", path)
        return "Error: Invalid data from weather service."

    return json.dumps(data)


def build_weather_tools(wrapper_base_url: str) -> list:
    base = wrapper_base_url.rstrip("/")

    @tool
    def get_current_weather(city: str) -> str:
        """Get current weather conditions (temp, humidity, wind) for a specific city.

        Use when the user asks about weather right now.
        """
        city = (city or "").strip()
        if not city:
            return "Error: city is required."
        return _call_weather_endpoint(
            "GET",
            "/weather/current",
            base_url=base,
            params={"city": city},
        )

    @tool
    def get_forecast(city: str, days: int = 3) -> str:
        """Get multi-day weather forecast for a city.

        Use when asked about future weather. days is 1–5 (default 3).
        """
        city = (city or "").strip()
        if not city:
            return "Error: city is required."
        if days < 1 or days > 5:
            return "Error: days must be between 1 and 5."
        return _call_weather_endpoint(
            "GET",
            "/weather/forecast",
            base_url=base,
            params={"city": city, "days": days},
        )

    @tool
    def get_air_quality(city: str) -> str:
        """Get current air quality index (AQI) and pollutant levels for a city.

        Use when the user asks about air quality, pollution, or smog.
        """
        city = (city or "").strip()
        if not city:
            return "Error: city is required."
        return _call_weather_endpoint(
            "GET",
            "/weather/air-quality",
            base_url=base,
            params={"city": city},
        )

    return [get_current_weather, get_forecast, get_air_quality]
