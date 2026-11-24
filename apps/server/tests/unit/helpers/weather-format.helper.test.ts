import { describe, expect, it } from 'vitest';
import { formatForecast, formatPlaces } from '../../../src/helpers/weather-format.helper.ts';
import type { Forecast, Place } from '../../../src/models/weather.model.ts';

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

describe('weather-format.helper', () => {
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
});
