import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';
import type { SdkMcpToolDefinition } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { OpenMeteoError } from './errors/open-meteo-error.ts';
import type { DailyWeather, Forecast, OpenMeteo, Place } from './open-meteo.ts';
import { describeWeatherCode } from './weather-codes.ts';

/** The MCP server name the tools are registered under; Claude sees them as `mcp__weather__<tool>`. */
export const weatherServerName = 'weather';

/** The tool names to allow in the Claude Agent SDK's `allowedTools`. */
export const weatherToolNames = [`mcp__${weatherServerName}__find_city`, `mcp__${weatherServerName}__get_forecast`];

// What a tool handler returns: the MCP result type, inferred from the SDK rather than restated.
type TextResult = Awaited<ReturnType<SdkMcpToolDefinition['handler']>>;

function text(value: string, isError = false): TextResult {
  return { content: [{ type: 'text', text: value }], ...(isError ? { isError } : {}) };
}

// A refusal from Open-Meteo goes back to Claude as a tool error it can explain; anything else is a bug and propagates.
async function answer(produce: () => Promise<string>): Promise<TextResult> {
  try {
    return text(await produce());
  } catch (error) {
    if (error instanceof OpenMeteoError) {
      return text(error.message, true);
    }
    throw error;
  }
}

/** One line per place, with what tells places of the same name apart and the coordinates to forecast. */
export function formatPlaces(name: string, places: readonly Place[]): string {
  if (places.length === 0) {
    return `No place named "${name}" was found.`;
  }
  return places
    .map((place) => {
      const where = [place.name, place.admin1, place.country].filter((part) => part !== undefined).join(', ');
      return `${where} (latitude ${String(place.latitude)}, longitude ${String(place.longitude)}, time zone ${place.timezone ?? 'unknown'})`;
    })
    .join('\n');
}

function formatDay(day: DailyWeather): string {
  const chance = day.precipitationChancePercent === undefined ? '' : `, ${String(day.precipitationChancePercent)}% chance of precipitation`;
  return (
    `${day.date}: ${describeWeatherCode(day.weatherCode)}, ${String(day.minC)} to ${String(day.maxC)} °C` +
    `${chance}, ${String(day.precipitationMm)} mm, wind up to ${String(day.maxWindKmh)} km/h`
  );
}

/** The forecast as plain lines: the weather now, then one line per day, in the place's local time. */
export function formatForecast(forecast: Forecast): string {
  const now = forecast.current;
  return [
    `Time zone: ${forecast.timezone}`,
    `Now (${now.time}): ${describeWeatherCode(now.weatherCode)}, ${String(now.temperatureC)} °C, feels like ${String(now.feelsLikeC)} °C, ` +
      `humidity ${String(now.humidityPercent)}%, wind ${String(now.windKmh)} km/h`,
    ...forecast.days.map(formatDay)
  ].join('\n');
}

/** `find_city`: the places matching a name, so Claude can pick one or ask which one the user means. */
export function findCityTool(weather: OpenMeteo) {
  return tool(
    'find_city',
    'Finds the places with a given name and returns their region, country, coordinates and time zone. Use it before get_forecast.',
    { name: z.string().min(1).describe('The city or place name, for example "Lisbon" or "Springfield"') },
    ({ name }) => answer(async () => formatPlaces(name, await weather.findPlaces(name)))
  );
}

/** `get_forecast`: the weather now and for the next days at one place. */
export function getForecastTool(weather: OpenMeteo) {
  return tool(
    'get_forecast',
    'Gets the current weather and a daily forecast (up to 7 days, starting today) for coordinates found with find_city.',
    {
      latitude: z.number().min(-90).max(90),
      longitude: z.number().min(-180).max(180),
      days: z.number().int().min(1).max(7).describe('How many days to forecast, starting today')
    },
    ({ latitude, longitude, days }) => answer(async () => formatForecast(await weather.forecast(latitude, longitude, days)))
  );
}

/** The in-process MCP server that gives Claude the two weather tools. */
export function weatherMcpServer(weather: OpenMeteo) {
  return createSdkMcpServer({ name: weatherServerName, version: '0.1.0', tools: [findCityTool(weather), getForecastTool(weather)] });
}
