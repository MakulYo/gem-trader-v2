// Test environment detection logic
const hostnames = ['tsdgems-dev.web.app', 'tsdgems.xyz', 'www.tsdgems.xyz', 'localhost', 'unknown-domain.com'];

hostnames.forEach(host => {
  const isLocal = host === "localhost" || host === "127.0.0.1";
  const isDevHost =
    isLocal ||
    host.includes("tsdgems-dev") ||
    host.includes("tsdm-6896d") ||
    host === "dev.tsdgems.app" ||
    host.endsWith(".dev.tsdgems.app");
  const isProdHost =
    host === "tsdgems.xyz" ||
    host === "www.tsdgems.xyz" ||
    host.endsWith(".tsdgems.xyz") ||
    host.includes("tsdgems-trading");

  const env = isDevHost ? "dev" : (isProdHost ? "prod" : "prod");
  console.log(`${host} → ${env} (isDev: ${isDevHost}, isProd: ${isProdHost})`);
});
