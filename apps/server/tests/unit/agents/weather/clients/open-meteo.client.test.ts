import { describe, expect, it } from 'vitest';
import { OpenMeteoError } from '../../../../../src/agents/weather/models/weather.model.ts';
import { openMeteoClient } from '../../../../../src/agents/weather/clients/open-meteo.client.ts';
import { lisbonForecast, lisbonSearch, rateLimited } from '../../../../fixtures/open-meteo.ts';

function answering(body: unknown, status = 200) {
  const requested: URL[] = [];
  const fetchUrl = (url: string) => {
    requested.push(new URL(url));
    return Promise.resolve(Response.json(body, { status }));
  };
  return { requested, client: openMeteoClient(fetchUrl) };
}

describe('openMeteoClient', () => {
  describe('findPlaces', () => {
    it('searches the geocoding API by name and answers the places it finds', async () => {
      const { requested, client } = answering(lisbonSearch);

      const places = await client.findPlaces('Lisbon');

      expect(places.map(({ name, country }) => `${name}, ${country ?? ''}`)).toEqual(['Lisbon, Portugal', 'Lisbon, United States']);
      expect(requested[0]?.host).toBe('geocoding-api.open-meteo.com');
      expect(requested[0]?.searchParams.get('name')).toBe('Lisbon');
    });

    it('answers no places when the search finds none', async () => {
      const { client } = answering({ generationtime_ms: 0.1 });

      expect(await client.findPlaces('Atlantis')).toEqual([]);
    });
  });

  describe('forecast', () => {
    it('asks for the forecast at the coordinates for the number of days, in local time', async () => {
      const { requested, client } = answering(lisbonForecast);

      await client.forecast(38.72, -9.13, 2);

      expect(requested[0]?.host).toBe('api.open-meteo.com');
      expect(Object.fromEntries(requested[0]?.searchParams ?? [])).toMatchObject({
        latitude: '38.72',
        longitude: '-9.13',
        forecast_days: '2',
        timezone: 'auto'
      });
    });

    it('answers the weather now and one entry per day, in metric units', async () => {
      const { client } = answering(lisbonForecast);

      const forecast = await client.forecast(38.72, -9.13, 2);

      expect(forecast.current).toEqual({
        time: '2026-11-24T10:00',
        temperatureC: 15.2,
        feelsLikeC: 13.9,
        humidityPercent: 81,
        weatherCode: 61,
        windKmh: 18.4
      });
      expect(forecast.days).toEqual([
        {
          date: '2026-11-24',
          weatherCode: 61,
          maxC: 16.8,
          minC: 11.3,
          precipitationChancePercent: 85,
          precipitationMm: 6.2,
          maxWindKmh: 27.5
        },
        {
          date: '2026-11-25',
          weatherCode: 2,
          maxC: 18.1,
          minC: 10.9,
          precipitationChancePercent: undefined,
          precipitationMm: 0,
          maxWindKmh: 14
        }
      ]);
    });

    it('leaves out a day whose values do not line up', async () => {
      const { client } = answering({ ...lisbonForecast, daily: { ...lisbonForecast.daily, temperature_2m_max: [16.8] } });

      expect((await client.forecast(38.72, -9.13, 2)).days.map(({ date }) => date)).toEqual(['2026-11-24']);
    });
  });

  it('names the API it could not reach', async () => {
    const client = openMeteoClient(() => Promise.reject(new TypeError('fetch failed')));

    await expect(client.findPlaces('Lisbon')).rejects.toThrow(
      new OpenMeteoError('Open-Meteo geocoding could not be reached: fetch failed')
    );
  });

  it.each([
    [
      'carries the reason Open-Meteo gives for a refusal',
      rateLimited,
      429,
      'Open-Meteo forecast refused the request: Daily API request limit exceeded'
    ],
    ['names the status of an error without a reason', 'Bad gateway', 502, 'Open-Meteo forecast answered 502'],
    ['rejects a body it cannot read', { daily: 'none' }, 200, 'Open-Meteo forecast answered with a body this client cannot read']
  ])('%s', async (_case, body, status, message) => {
    const { client } = answering(body, status);

    await expect(client.forecast(38.72, -9.13, 2)).rejects.toThrow(OpenMeteoError);
    await expect(client.forecast(38.72, -9.13, 2)).rejects.toThrow(message);
  });
});
