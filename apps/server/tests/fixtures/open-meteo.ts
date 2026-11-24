// Bodies in the shape Open-Meteo answers, trimmed to the fields the client asks for.

export const lisbonSearch = {
  results: [
    {
      id: 2267057,
      name: 'Lisbon',
      latitude: 38.72509,
      longitude: -9.1498,
      country: 'Portugal',
      admin1: 'Lisbon District',
      timezone: 'Europe/Lisbon'
    },
    {
      id: 5160951,
      name: 'Lisbon',
      latitude: 40.772,
      longitude: -80.76813,
      country: 'United States',
      admin1: 'Ohio',
      timezone: 'America/New_York'
    }
  ],
  generationtime_ms: 0.1
};

export const lisbonForecast = {
  latitude: 38.72,
  longitude: -9.13,
  timezone: 'Europe/Lisbon',
  current: {
    time: '2026-11-24T10:00',
    temperature_2m: 15.2,
    apparent_temperature: 13.9,
    relative_humidity_2m: 81,
    weather_code: 61,
    wind_speed_10m: 18.4
  },
  daily: {
    time: ['2026-11-24', '2026-11-25'],
    weather_code: [61, 2],
    temperature_2m_max: [16.8, 18.1],
    temperature_2m_min: [11.3, 10.9],
    precipitation_probability_max: [85, null],
    precipitation_sum: [6.2, 0],
    wind_speed_10m_max: [27.5, 14.0]
  }
};

export const rateLimited = { error: true, reason: 'Daily API request limit exceeded. Please try again tomorrow.' };
