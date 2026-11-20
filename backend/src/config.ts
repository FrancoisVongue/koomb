import { venum } from 'venum';

export type Config = {
  port: number;
  databaseFile: string;
};

export namespace Config {
  export const DEFAULT_PORT = 3000;
  export const DEFAULT_DATABASE_FILE = 'data/koomb.db';

  export const parse = (env: Record<string, string | undefined>) => {
    const port = env.PORT === undefined ? DEFAULT_PORT : Number(env.PORT);
    if (!Number.isInteger(port) || port < 1 || port > 65_535) {
      return venum('invalid', { message: `PORT must be a port number, got "${env.PORT}"` });
    }
    return venum('ok', {
      port,
      databaseFile: env.DATABASE_FILE ?? DEFAULT_DATABASE_FILE,
    } satisfies Config);
  };
}
