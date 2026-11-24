import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';
import type { SdkMcpToolDefinition } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { formatForecast, formatPlaces } from '../helpers/weather-format.helper.ts';
import { OpenMeteoError } from '../models/weather.model.ts';
import type { WeatherService } from '../models/weather.model.ts';

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

/** `find_city`: the places matching a name, so Claude can pick one or ask which one the user means. */
export function findCityTool(weather: WeatherService) {
  return tool(
    'find_city',
    'Finds the places with a given name and returns their region, country, coordinates and time zone. Use it before get_forecast.',
    { name: z.string().min(1).describe('The city or place name, for example "Lisbon" or "Springfield"') },
    ({ name }) => answer(async () => formatPlaces(name, await weather.findPlaces(name)))
  );
}

/** `get_forecast`: the weather now and for the next days at one place. */
export function getForecastTool(weather: WeatherService) {
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
export function weatherMcpServer(weather: WeatherService) {
  return createSdkMcpServer({ name: weatherServerName, version: '0.1.0', tools: [findCityTool(weather), getForecastTool(weather)] });
}
