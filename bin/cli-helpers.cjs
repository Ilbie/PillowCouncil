function resolveHost(env) {
  const explicitHost = typeof env.HOST === 'string' ? env.HOST.trim() : '';
  return explicitHost || '127.0.0.1';
}

function handleStartupFailure(child, error) {
  if (child && !child.killed) {
    child.kill('SIGTERM');
  }

  throw error;
}

module.exports = {
  resolveHostForTests: resolveHost,
  handleStartupFailureForTests: handleStartupFailure,
  resolveHost,
  handleStartupFailure
};
