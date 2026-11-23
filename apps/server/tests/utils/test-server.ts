import { createServer } from 'node:http';
import type { RequestListener, Server } from 'node:http';
import type { AddressInfo } from 'node:net';

export interface TestServer {
  readonly baseUrl: string;
  /** Hands every request to `listener`, typically the app built for `baseUrl`. */
  readonly serve: (listener: RequestListener) => void;
  readonly close: () => Promise<void>;
}

/** An HTTP server on an ephemeral port, listening before the app exists so the app can be built for its URL. */
export async function listen(): Promise<TestServer> {
  const server = await new Promise<Server>((resolve) => {
    const listening = createServer().listen(0, '127.0.0.1', () => {
      resolve(listening);
    });
  });
  const { port } = server.address() as AddressInfo;
  return {
    baseUrl: `http://127.0.0.1:${String(port)}`,
    serve: (listener) => {
      server.on('request', listener);
    },
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      })
  };
}
