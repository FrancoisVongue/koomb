import dotenv from 'dotenv';
import { match } from 'venum';
import { createApp } from './app.ts';
import { Config } from './config.ts';
import { sweep } from './models/scrape/controller.ts';
import { Sweep } from './models/scrape/types.ts';
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

// Safety net for pages that were missed or got stuck (e.g. after a restart).
services.scheduler.cron(Sweep.SCHEDULE, () => sweep(services));
