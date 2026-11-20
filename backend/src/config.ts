import { venum } from 'venum';
import { z } from 'zod';

export type Config = z.infer<typeof Config.schema>;

export namespace Config {
  /** Every variable is optional; see .env.example. */
  export const schema = z
    .object({
      PORT: z.coerce.number().int().min(1).max(65_535).default(3031),
      DATABASE_FILE: z.string().min(1).default('data/koomb.db'),
    })
    .transform((env) => ({ port: env.PORT, databaseFile: env.DATABASE_FILE }));

  export const parse = (env: Record<string, string | undefined>) => {
    const result = schema.safeParse(env);
    if (!result.success) return venum('invalid', { message: z.prettifyError(result.error) });
    return venum('ok', result.data);
  };
}
