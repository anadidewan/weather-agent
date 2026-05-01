import { Router, type Request, type Response, type NextFunction } from "express";
import {
  fetchAirPollution,
  fetchCurrentWeather,
  fetchForecast,
  fetchGeo
} from "../services/openweather.js";
import {
  AppError,
  type AirQualityResponse,
  type CurrentWeatherResponse,
  type ForecastDay,
  type ForecastResponse
} from "../types.js";

const router = Router();

const AQI_LABELS: Record<number, string> = {
  1: "Good",
  2: "Fair",
  3: "Moderate",
  4: "Poor",
  5: "Very Poor"
};

function validateCity(city: string | undefined): string {
  if (!city || !city.trim()) {
    throw new AppError(400, "Missing or invalid city");
  }
  return city.trim();
}

function parseDays(input: string | undefined): number {
  if (input === undefined) {
    return 3;
  }
  const days = Number(input);
  if (!Number.isInteger(days) || days < 1 || days > 5) {
    throw new AppError(400, "days must be an integer between 1 and 5");
  }
  return days;
}

function asyncHandler(handler: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => {
    handler(req, res).catch(next);
  };
}

router.get(
  "/current",
  asyncHandler(async (req, res) => {
    const city = validateCity(req.query.city as string | undefined);
    const daysQuery = req.query.days as string | undefined;

    if (daysQuery !== undefined) {
      const forecast = await buildForecast(city, parseDays(daysQuery));
      res.status(200).json(forecast);
      return;
    }

    const raw = await fetchCurrentWeather(city);
    const response: CurrentWeatherResponse = {
      city: raw.name,
      country: raw.sys?.country ?? "",
      temperatureF: Number(raw.main?.temp ?? 0),
      feelsLike: Number(raw.main?.feels_like ?? 0),
      conditions: raw.weather?.[0]?.description ?? "Unknown",
      humidity: Number(raw.main?.humidity ?? 0),
      windMph: Number(raw.wind?.speed ?? 0),
      observedAt: new Date((raw.dt ?? 0) * 1000).toISOString()
    };
    res.status(200).json(response);
  })
);

router.get(
  "/forecast",
  asyncHandler(async (req, res) => {
    const city = validateCity(req.query.city as string | undefined);
    const days = parseDays(req.query.days as string | undefined);
    const forecast = await buildForecast(city, days);
    res.status(200).json(forecast);
  })
);

router.get(
  "/air-quality",
  asyncHandler(async (req, res) => {
    const city = validateCity(req.query.city as string | undefined);
    const geo = await fetchGeo(city);

    if (!Array.isArray(geo) || geo.length === 0) {
      throw new AppError(303, "City not found");
    }

    const location = geo[0];
    const lat = Number(location.lat);
    const lon = Number(location.lon);
    const air = await fetchAirPollution(lat, lon);
    const first = air.list?.[0];
    const aqi = Number(first?.main?.aqi ?? 0);

    const response: AirQualityResponse = {
      city: location.name ?? city,
      country: location.country ?? "",
      aqi,
      aqiLabel: AQI_LABELS[aqi] ?? "Unknown",
      components: {
        pm25: Number(first?.components?.pm2_5 ?? 0),
        pm10: Number(first?.components?.pm10 ?? 0),
        o3: Number(first?.components?.o3 ?? 0),
        no2: Number(first?.components?.no2 ?? 0)
      }
    };

    res.status(200).json(response);
  })
);

async function buildForecast(city: string, days: number): Promise<ForecastResponse> {
  const raw = await fetchForecast(city);

  type Bucket = {
    date: string;
    highF: number;
    lowF: number;
    rainMax: number;
    conditions: string[];
  };

  const byDate = new Map<string, Bucket>();

  for (const item of raw.list ?? []) {
    const date = String(item.dt_txt ?? "").slice(0, 10);
    if (!date) {
      continue;
    }

    const tempMax = Number(item.main?.temp_max ?? item.main?.temp ?? 0);
    const tempMin = Number(item.main?.temp_min ?? item.main?.temp ?? 0);
    const popPct = Math.round(Number(item.pop ?? 0) * 100);
    const condition = item.weather?.[0]?.main ?? "Unknown";

    if (!byDate.has(date)) {
      byDate.set(date, {
        date,
        highF: tempMax,
        lowF: tempMin,
        rainMax: popPct,
        conditions: [condition]
      });
      continue;
    }

    const bucket = byDate.get(date)!;
    bucket.highF = Math.max(bucket.highF, tempMax);
    bucket.lowF = Math.min(bucket.lowF, tempMin);
    bucket.rainMax = Math.max(bucket.rainMax, popPct);
    bucket.conditions.push(condition);
  }

  const daysData: ForecastDay[] = [...byDate.values()]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, days)
    .map((bucket) => ({
      date: bucket.date,
      highF: Number(bucket.highF.toFixed(1)),
      lowF: Number(bucket.lowF.toFixed(1)),
      conditions: mostFrequent(bucket.conditions),
      chanceOfRainPct: bucket.rainMax
    }));

  return {
    city: raw.city?.name ?? city,
    country: raw.city?.country ?? "",
    days: daysData
  };
}

function mostFrequent(values: string[]): string {
  const counts = new Map<string, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  let winner = "Unknown";
  let maxCount = -1;
  for (const [value, count] of counts.entries()) {
    if (count > maxCount) {
      maxCount = count;
      winner = value;
    }
  }
  return winner;
}

export default router;
