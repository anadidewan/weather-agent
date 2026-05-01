export type CurrentWeatherResponse = {
  city: string;
  country: string;
  temperatureF: number;
  feelsLike: number;
  conditions: string;
  humidity: number;
  windMph: number;
  observedAt: string;
};

export type ForecastDay = {
  date: string;
  highF: number;
  lowF: number;
  conditions: string;
  chanceOfRainPct: number;
};

export type ForecastResponse = {
  city: string;
  country: string;
  days: ForecastDay[];
};

export type AirQualityResponse = {
  city: string;
  country: string;
  aqi: number;
  aqiLabel: string;
  components: {
    pm25: number;
    pm10: number;
    o3: number;
    no2: number;
  };
};

export class AppError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
