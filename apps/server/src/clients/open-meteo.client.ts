import { z } from 'zod';
import { OpenMeteoError } from '../models/weather.model.ts';
import type { DailyWeather, Place, WeatherService } from '../models/weather.model.ts';

export type Fetch = (url: string) => Promise<Response>;

// The wire formats of the two Open-Meteo APIs, trimmed to the fields the client asks for.

const placeSchema = z.object({
  name: z.string(),
  latitude: z.number(),
  longitude: z.number(),
  country: z.string().optional(),
  admin1: z.string().optional(),
  timezone: z.string().optional()
}) satisfies z.ZodType<Place>;

const searchSchema = z.object({ results: z.array(placeSchema).optional() });

const forecastSchema = z.object({
  timezone: z.string(),
  current: z.object({
    time: z.string(),
    temperature_2m: z.number(),
    apparent_temperature: z.number(),
    relative_humidity_2m: z.number(),
    weather_code: z.number(),
    wind_speed_10m: z.number()
  }),
  daily: z.object({
    time: z.array(z.string()),
    weather_code: z.array(z.number()),
    temperature_2m_max: z.array(z.number()),
    temperature_2m_min: z.array(z.number()),
    precipitation_probability_max: z.array(z.number().nullable()),
    precipitation_sum: z.array(z.number()),
    wind_speed_10m_max: z.array(z.number())
  })
});

const refusalSchema = z.object({ error: z.literal(true), reason: z.string() });

// Every way a request can fail (unreachable, refused, unreadable) becomes an OpenMeteoError naming the API.
async function get<T>(what: string, fetchUrl: Fetch, url: string, schema: z.ZodType<T>): Promise<T> {
  let response: Response;
  try {
    response = await fetchUrl(url);
  } catch (error) {
    throw new OpenMeteoError(`${what} could not be reached: ${error instanceof Error ? error.message : String(error)}`);
  }
  const body: unknown = await response.json().catch(() => undefined);
  const refusal = refusalSchema.safeParse(body);
  if (refusal.success) {
    throw new OpenMeteoError(`${what} refused the request: ${refusal.data.reason}`);
  }
  if (!response.ok) {
    throw new OpenMeteoError(`${what} answered ${String(response.status)}`);
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new OpenMeteoError(`${what} answered with a body this client cannot read`);
  }
  return parsed.data;
}

/** The Open-Meteo geocoding and forecast APIs, which need no key; `fetchUrl` is the global `fetch` unless a test hands in its own. */
export function openMeteoClient(fetchUrl: Fetch = fetch): WeatherService {
  return {
    findPlaces: async (name) => {
      const query = new URLSearchParams({ name, count: '5', language: 'en', format: 'json' });
      const url = `https://geocoding-api.open-meteo.com/v1/search?${query.toString()}`;
      const { results } = await get('Open-Meteo geocoding', fetchUrl, url, searchSchema);
      return results ?? [];
    },
    forecast: async (latitude, longitude, days) => {
      const query = new URLSearchParams({
        latitude: String(latitude),
        longitude: String(longitude),
        current: 'temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m',
        daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,wind_speed_10m_max',
        timezone: 'auto',
        forecast_days: String(days)
      });
      const url = `https://api.open-meteo.com/v1/forecast?${query.toString()}`;
      const { timezone, current, daily } = await get('Open-Meteo forecast', fetchUrl, url, forecastSchema);
      // Open-Meteo answers one array per variable, aligned by day; a day missing any required value is left out.
      const forecastDays = daily.time.flatMap((date, i): DailyWeather[] => {
        const weatherCode = daily.weather_code[i];
        const maxC = daily.temperature_2m_max[i];
        const minC = daily.temperature_2m_min[i];
        const precipitationMm = daily.precipitation_sum[i];
        const maxWindKmh = daily.wind_speed_10m_max[i];
        if (
          weatherCode === undefined ||
          maxC === undefined ||
          minC === undefined ||
          precipitationMm === undefined ||
          maxWindKmh === undefined
        ) {
          return [];
        }
        const precipitationChancePercent = daily.precipitation_probability_max[i] ?? undefined;
        return [{ date, weatherCode, maxC, minC, precipitationChancePercent, precipitationMm, maxWindKmh }];
      });
      return {
        timezone,
        current: {
          time: current.time,
          temperatureC: current.temperature_2m,
          feelsLikeC: current.apparent_temperature,
          humidityPercent: current.relative_humidity_2m,
          weatherCode: current.weather_code,
          windKmh: current.wind_speed_10m
        },
        days: forecastDays
      };
    }
  };
}
