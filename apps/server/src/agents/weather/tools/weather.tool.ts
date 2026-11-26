import { z } from 'zod';
import { defineTool } from '../../core/a2a-agent.ts';
import type { AgentTool } from '../../core/a2a-agent.ts';
import { formatForecast, formatPlaces } from '../helpers/weather-format.helper.ts';
import type { WeatherService } from '../models/weather.model.ts';

// Open-Meteo's refusals are `OpenMeteoError`s, which are tool errors: the runner hands them back to the model to explain.

/** `find_city`: the places matching a name, so the model can pick one or ask which one the user means. */
export function findCityTool(weather: WeatherService): AgentTool {
  return defineTool({
    name: 'find_city',
    description:
      'Finds the places with a given name and returns their region, country, coordinates and time zone. Use it before get_forecast.',
    input: z.object({ name: z.string().min(1).describe('The city or place name, for example "Lisbon" or "Springfield"') }),
    async run({ name }) {
      const places = await weather.findPlaces(name);
      return formatPlaces(name, places);
    }
  });
}

/** `get_forecast`: the weather now and for the next days at one place. */
export function getForecastTool(weather: WeatherService): AgentTool {
  return defineTool({
    name: 'get_forecast',
    description: 'Gets the current weather and a daily forecast (up to 7 days, starting today) for coordinates found with find_city.',
    input: z.object({
      latitude: z.number().min(-90).max(90),
      longitude: z.number().min(-180).max(180),
      days: z.number().int().min(1).max(7).describe('How many days to forecast, starting today')
    }),
    async run({ latitude, longitude, days }) {
      const forecast = await weather.forecast(latitude, longitude, days);
      return formatForecast(forecast);
    }
  });
}

/** The weather agent's two tools. */
export function weatherTools(weather: WeatherService): AgentTool[] {
  return [findCityTool(weather), getForecastTool(weather)];
}
