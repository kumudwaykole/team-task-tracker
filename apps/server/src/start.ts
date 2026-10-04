// Entry for `pnpm start` (the compiled build): production mode unless NODE_ENV is set explicitly.
// Set before the server loads .env, and dotenv never overrides a variable that is already set.
process.env['NODE_ENV'] ??= 'production';
await import('./server.js');
