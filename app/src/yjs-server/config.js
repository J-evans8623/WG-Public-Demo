/**
 * config.js
 *
 * Responsibilities:
 *  - Parse environment variables and CLI flags (--port, --redis-url, --auth-public-key, --auth-issuer, --acl-enabled, --log-level).
 *  - Provide a single source of truth for server configuration, including JWT and ACL settings.
 */

const yargs = require('yargs');

const argv = yargs(process.argv.slice(2))
  .option('port', {
    alias: 'p',
    type: 'number',
    description: 'Server listening port',
    default: parseInt(process.env.PORT, 10) || 1234,
  })
  .option('redis-url', {
    alias: 'r',
    type: 'string',
    description: 'Redis connection URL',
    default: process.env.REDIS_URL,
  })
  .option('auth-public-key', {
    alias: 'k',
    type: 'string',
    description: 'PEM-encoded public key for JWT validation',
    default: process.env.AUTH_PUBLIC_KEY,
  })
  .option('auth-issuer', {
    alias: 'i',
    type: 'string',
    description: 'Expected JWT issuer (iss claim)',
    default: process.env.AUTH_ISSUER,
  })
  .option('acl-enabled', {
    alias: 'a',
    type: 'boolean',
    description: 'Enable role-based ACL enforcement',
    default: process.env.ACL_ENABLED === 'true' || false,
  })
  .option('log-level', {
    alias: 'l',
    type: 'string',
    choices: ['info', 'debug'],
    description: 'Logging verbosity',
    default: process.env.LOG_LEVEL || 'info',
  })
  .help(false)
  .argv;

module.exports = {
  port: argv.port,
  redisUrl: argv['redis-url'],
  authPublicKey: argv['auth-public-key'],
  authIssuer: argv['auth-issuer'],
  aclEnabled: argv['acl-enabled'],
  logLevel: argv['log-level'],
};
