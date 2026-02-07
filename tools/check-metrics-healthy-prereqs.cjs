const net = require("net");

function getHost() {
  return process.env.BQ_TEST_METRICS_HOST || "127.0.0.1";
}

function getPort() {
  const raw = process.env.BQ_TEST_METRICS_PORT || "11211";
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(
      `Invalid BQ_TEST_METRICS_PORT value "${raw}". Expected a positive integer.`
    );
  }
  return parsed;
}

function hasMemcacheDependency() {
  try {
    require.resolve("memcache");
    return true;
  } catch (_) {
    return false;
  }
}

function canReachMemcached(host, port, timeoutMs) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host, port });

    const onError = (err) => {
      socket.destroy();
      reject(err);
    };

    socket.setTimeout(timeoutMs);
    socket.once("error", onError);
    socket.once("timeout", () => {
      onError(new Error(`Connection timed out after ${timeoutMs}ms`));
    });
    socket.once("connect", () => {
      socket.end();
      resolve();
    });
  });
}

async function main() {
  const host = getHost();
  const port = getPort();

  if (!hasMemcacheDependency()) {
    throw new Error(
      'Missing optional dependency "memcache". Run `bun add memcache` before `bun run test:metrics:healthy`.'
    );
  }

  try {
    await canReachMemcached(host, port, 1500);
  } catch (err) {
    const detail = err && err.message ? err.message : String(err);
    throw new Error(
      `Memcached is not reachable at ${host}:${port} (${detail}). Start memcached or adjust BQ_TEST_METRICS_HOST/BQ_TEST_METRICS_PORT.`
    );
  }

  console.log(
    `metrics-healthy-prereqs: ok (memcache dependency installed, memcached reachable at ${host}:${port})`
  );
}

main().catch((err) => {
  const message = err && err.message ? err.message : String(err);
  console.error(`metrics-healthy-prereqs: fail (${message})`);
  process.exit(1);
});
