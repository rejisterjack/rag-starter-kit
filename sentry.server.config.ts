import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  
  // Define how likely traces are sampled
  tracesSampleRate: 1.0,

  // Setting this option to true will print useful information to the console
  debug: process.env.NODE_ENV === 'development',
});
