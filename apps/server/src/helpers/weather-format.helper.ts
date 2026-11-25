import type { Forecast, Place } from '../models/weather.model.ts';
import { describeWeatherCode } from './weather-code.helper.ts';

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

/** The forecast as plain lines: the weather now, then one line per day, in the place's local time. */
export function formatForecast(forecast: Forecast): string {
  const now = forecast.current;
  return [
    `Time zone: ${forecast.timezone}`,
    `Now (${now.time}): ${describeWeatherCode(now.weatherCode)}, ${String(now.temperatureC)} °C, feels like ${String(now.feelsLikeC)} °C, ` +
      `humidity ${String(now.humidityPercent)}%, wind ${String(now.windKmh)} km/h`,
    ...forecast.days.map((day) => {
      const chance =
        day.precipitationChancePercent === undefined ? '' : `, ${String(day.precipitationChancePercent)}% chance of precipitation`;
      return (
        `${day.date}: ${describeWeatherCode(day.weatherCode)}, ${String(day.minC)} to ${String(day.maxC)} °C` +
        `${chance}, ${String(day.precipitationMm)} mm, wind up to ${String(day.maxWindKmh)} km/h`
      );
    })
  ].join('\n');
}
