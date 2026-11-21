import dotenv from 'dotenv';
import { match } from 'venum';
import { createApp } from './app.ts';
import { Config } from './config.ts';
import { startCron } from './cron.ts';
import { createServices } from './services/index.ts';

// Optional backend/.env (see .env.example), validated by Config.
dotenv.config({ quiet: true });

const config = match(Config.parse(process.env), {
  ok: (config) => config,
  invalid: ({ message }) => {
    console.error(message);
    process.exit(1);
  },
});

const services = createServices(config);

const app = createApp(services);
app.listen(config.port, () => {
  console.log(`Backend listening on http://localhost:${config.port}`);
});

// The two entrances: HTTP (clients) and cron (time).
startCron(services);
