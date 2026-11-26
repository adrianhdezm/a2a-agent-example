import { describe, expect, it } from 'vitest';
import { formatForecast, formatPlaces } from '../../../../../src/agents/weather/helpers/weather-format.helper.ts';
import { OpenMeteoError } from '../../../../../src/agents/weather/models/weather.model.ts';
import type { Forecast, Place, WeatherService } from '../../../../../src/agents/weather/models/weather.model.ts';
import { runTool } from '../../../../../src/agents/core/helpers/tool.helper.ts';
import { findCityTool, getForecastTool, weatherTools } from '../../../../../src/agents/weather/tools/weather.tool.ts';

const lisbon: Place = {
  name: 'Lisbon',
  latitude: 38.72509,
  longitude: -9.1498,
  country: 'Portugal',
  admin1: 'Lisbon District',
  timezone: 'Europe/Lisbon'
};

const forecast: Forecast = {
  timezone: 'Europe/Lisbon',
  current: { time: '2026-11-24T10:00', temperatureC: 15.2, feelsLikeC: 13.9, humidityPercent: 81, weatherCode: 61, windKmh: 18.4 },
  days: [
    { date: '2026-11-24', weatherCode: 61, maxC: 16.8, minC: 11.3, precipitationChancePercent: 85, precipitationMm: 6.2, maxWindKmh: 27.5 },
    { date: '2026-11-25', weatherCode: 2, maxC: 18.1, minC: 10.9, precipitationMm: 0, maxWindKmh: 14 }
  ]
};

function fakeWeather(overrides: Partial<WeatherService> = {}): WeatherService {
  return { findPlaces: () => Promise.resolve([lisbon]), forecast: () => Promise.resolve(forecast), ...overrides };
}

describe('weather.tool', () => {
  const context = { contextId: 'context-1', signal: new AbortController().signal };

  it('offers find_city and get_forecast', () => {
    expect(weatherTools(fakeWeather()).map(({ name }) => name)).toEqual(['find_city', 'get_forecast']);
  });

  describe('find_city', () => {
    it('answers the matching places as text', async () => {
      const result = await runTool(findCityTool(fakeWeather()), { name: 'Lisbon' }, context);

      expect(result).toEqual({ text: formatPlaces('Lisbon', [lisbon]), isError: false });
    });
  });

  describe('get_forecast', () => {
    it('forecasts the coordinates for the days asked', async () => {
      const asked: number[][] = [];
      const weather = fakeWeather({
        forecast: (latitude, longitude, days) => {
          asked.push([latitude, longitude, days]);
          return Promise.resolve(forecast);
        }
      });

      const result = await runTool(getForecastTool(weather), { latitude: 38.72, longitude: -9.13, days: 2 }, context);

      expect(asked).toEqual([[38.72, -9.13, 2]]);
      expect(result).toEqual({ text: formatForecast(forecast), isError: false });
    });

    it("turns Open-Meteo's refusal into a tool error the model can explain", async () => {
      const weather = fakeWeather({
        forecast: () => Promise.reject(new OpenMeteoError('Open-Meteo forecast refused the request: limit exceeded'))
      });

      const result = await runTool(getForecastTool(weather), { latitude: 38.72, longitude: -9.13, days: 2 }, context);

      expect(result).toEqual({ text: 'Open-Meteo forecast refused the request: limit exceeded', isError: true });
    });

    it('lets any other error through', async () => {
      const weather = fakeWeather({ forecast: () => Promise.reject(new TypeError('fetch failed')) });

      await expect(runTool(getForecastTool(weather), { latitude: 38.72, longitude: -9.13, days: 2 }, context)).rejects.toThrow(
        'fetch failed'
      );
    });
  });
});
