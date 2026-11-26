/** A place the geocoding search found. */
export interface Place {
  name: string;
  latitude: number;
  longitude: number;
  country?: string;
  admin1?: string;
  timezone?: string;
}

/** The weather now, in the place's local time; metric units. */
export interface CurrentWeather {
  time: string;
  temperatureC: number;
  feelsLikeC: number;
  humidityPercent: number;
  weatherCode: number;
  windKmh: number;
}

/** One day of the forecast, in the place's local time; metric units. */
export interface DailyWeather {
  date: string;
  weatherCode: number;
  maxC: number;
  minC: number;
  /** The highest chance of rain or snow that day; absent where the model gives none. */
  precipitationChancePercent?: number;
  precipitationMm: number;
  maxWindKmh: number;
}

export interface Forecast {
  timezone: string;
  current: CurrentWeather;
  days: DailyWeather[];
}

/** What the weather tools need from a weather service: places by name, and a forecast at coordinates. */
export interface WeatherService {
  findPlaces(name: string): Promise<Place[]>;
  forecast(latitude: number, longitude: number, days: number): Promise<Forecast>;
}

/** Thrown when Open-Meteo is unreachable, refuses a request, or answers with something the client cannot read. */
export class OpenMeteoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OpenMeteoError';
  }
}
