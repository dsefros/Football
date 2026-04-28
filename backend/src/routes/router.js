function splitPath(path) {
  return path.split('/').filter(Boolean);
}

function matchRoute(pattern, actualPath) {
  const a = splitPath(actualPath);
  const b = splitPath(pattern);
  if (a.length !== b.length) return null;
  const params = {};
  for (let i = 0; i < b.length; i += 1) {
    if (b[i].startsWith(':')) params[b[i].slice(1)] = decodeURIComponent(a[i]);
    else if (b[i] !== a[i]) return null;
  }
  return params;
}

function createRouter(routes) {
  return {
    routes,
    resolve(method, path) {
      for (const route of routes) {
        if (route.method !== method) continue;
        const params = matchRoute(route.path, path);
        if (params) return { route, params };
      }
      return null;
    }
  };
}

module.exports = { createRouter };
