import { describe, expect, it } from 'vitest';
import { OpenMeteoError } from '../src/errors/open-meteo-error.ts';
import type { Forecast, OpenMeteo, Place } from '../src/open-meteo.ts';
import { findCityTool, formatForecast, formatPlaces, getForecastTool, weatherToolNames } from '../src/weather-tools.ts';

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

function fakeWeather(overrides: Partial<OpenMeteo> = {}): OpenMeteo {
  return { findPlaces: () => Promise.resolve([lisbon]), forecast: () => Promise.resolve(forecast), ...overrides };
}

describe('weather-tools', () => {
  it('names the tools as Claude sees them on the weather server', () => {
    expect(weatherToolNames).toEqual(['mcp__weather__find_city', 'mcp__weather__get_forecast']);
  });

  describe('formatPlaces', () => {
    it('gives each place its region, country, coordinates and time zone', () => {
      expect(formatPlaces('Lisbon', [lisbon])).toBe(
        'Lisbon, Lisbon District, Portugal (latitude 38.72509, longitude -9.1498, time zone Europe/Lisbon)'
      );
    });

    it('says when no place has the name', () => {
      expect(formatPlaces('Atlantis', [])).toBe('No place named "Atlantis" was found.');
    });
  });

  describe('formatForecast', () => {
    it('describes the weather now and each day in words and metric units', () => {
      expect(formatForecast(forecast).split('\n')).toEqual([
        'Time zone: Europe/Lisbon',
        'Now (2026-11-24T10:00): light rain, 15.2 °C, feels like 13.9 °C, humidity 81%, wind 18.4 km/h',
        '2026-11-24: light rain, 11.3 to 16.8 °C, 85% chance of precipitation, 6.2 mm, wind up to 27.5 km/h',
        '2026-11-25: partly cloudy, 10.9 to 18.1 °C, 0 mm, wind up to 14 km/h'
      ]);
    });
  });

  describe('find_city', () => {
    it('answers the matching places as text', async () => {
      const result = await findCityTool(fakeWeather()).handler({ name: 'Lisbon' }, {});

      expect(result).toEqual({ content: [{ type: 'text', text: formatPlaces('Lisbon', [lisbon]) }] });
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

      const result = await getForecastTool(weather).handler({ latitude: 38.72, longitude: -9.13, days: 2 }, {});

      expect(asked).toEqual([[38.72, -9.13, 2]]);
      expect(result.content).toEqual([{ type: 'text', text: formatForecast(forecast) }]);
    });

    it("turns Open-Meteo's refusal into a tool error Claude can explain", async () => {
      const weather = fakeWeather({
        forecast: () => Promise.reject(new OpenMeteoError('Open-Meteo forecast refused the request: limit exceeded'))
      });

      const result = await getForecastTool(weather).handler({ latitude: 38.72, longitude: -9.13, days: 2 }, {});

      expect(result).toEqual({
        content: [{ type: 'text', text: 'Open-Meteo forecast refused the request: limit exceeded' }],
        isError: true
      });
    });

    it('lets any other error through', async () => {
      const weather = fakeWeather({ forecast: () => Promise.reject(new TypeError('fetch failed')) });

      await expect(getForecastTool(weather).handler({ latitude: 38.72, longitude: -9.13, days: 2 }, {})).rejects.toThrow('fetch failed');
    });
  });
});
