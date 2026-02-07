var defaultConfig = { host: "localhost", port: 8000, dispatcher: false };

var build =
  (typeof window !== "undefined" && window.BQ_BUILD_CONFIG) ? window.BQ_BUILD_CONFIG : defaultConfig;
var local =
  (typeof window !== "undefined" && window.BQ_LOCAL_CONFIG) ? window.BQ_LOCAL_CONFIG : null;

export default {
  dev: defaultConfig,
  build: build,
  local: local
};
