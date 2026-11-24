/** Thrown when Open-Meteo refuses a request or answers with something this client cannot read. */
export class OpenMeteoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OpenMeteoError';
  }
}
