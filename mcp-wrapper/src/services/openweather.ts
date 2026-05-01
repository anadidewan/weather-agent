import axios, { AxiosError } from "axios";
import { AppError } from "../types.js";

const client = axios.create({
  baseURL: "https://api.openweathermap.org",
  timeout: 10000
});

function getApiKey(): string {
  const key = process.env.OPENWEATHER_API_KEY;
  if (!key) {
    throw new AppError(500, "Server misconfiguration");
  }
  return key;
}

function normalizeUpstreamError(error: unknown): never {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<{ cod?: string | number; message?: string }>;
    const status = axiosError.response?.status;
    const cod = axiosError.response?.data?.cod;

    if (status === 404 || cod === "404" || cod === 404) {
      throw new AppError(303, "City not found");
    }

    if (typeof status === "number" && status >= 500) {
      throw new AppError(503, "OpenWeather service unavailable");
    }
  }

  throw new AppError(500, "Internal server error");
}

export async function fetchCurrentWeather(city: string) {
  try {
    const response = await client.get("/data/2.5/weather", {
      params: {
        q: city,
        units: "imperial",
        appid: getApiKey()
      }
    });
    return response.data;
  } catch (error) {
    normalizeUpstreamError(error);
  }
}

export async function fetchForecast(city: string) {
  try {
    const response = await client.get("/data/2.5/forecast", {
      params: {
        q: city,
        units: "imperial",
        appid: getApiKey()
      }
    });
    return response.data;
  } catch (error) {
    normalizeUpstreamError(error);
  }
}

export async function fetchGeo(city: string) {
  try {
    const response = await client.get("/geo/1.0/direct", {
      params: {
        q: city,
        limit: 1,
        appid: getApiKey()
      }
    });
    return response.data;
  } catch (error) {
    normalizeUpstreamError(error);
  }
}

export async function fetchAirPollution(lat: number, lon: number) {
  try {
    const response = await client.get("/data/2.5/air_pollution", {
      params: {
        lat,
        lon,
        appid: getApiKey()
      }
    });
    return response.data;
  } catch (error) {
    normalizeUpstreamError(error);
  }
}
