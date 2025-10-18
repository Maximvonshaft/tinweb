import fs from 'node:fs';
import path from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { MockMethod } from 'vite-plugin-mock';

interface DatasetRoute {
  method: string;
  path: string;
  status?: number;
  response: unknown;
  variant?: string;
  query?: Record<string, unknown>;
  headers_required?: Record<string, string>;
}

interface Dataset {
  routes: DatasetRoute[];
}

interface NormalizedHeaders {
  [key: string]: string;
}

const DATASET_PATH = path.resolve(process.cwd(), 'federated-drive-mock-dataset.json');

function normalizeHeaders(headers: IncomingMessage['headers']): NormalizedHeaders {
  const result: NormalizedHeaders = {};
  Object.entries(headers).forEach(([key, value]) => {
    if (!value) return;
    result[key.toLowerCase()] = Array.isArray(value) ? value[0] ?? '' : value;
  });
  return result;
}

function matchQuery(route: DatasetRoute, params: URLSearchParams): boolean {
  if (!route.query) return true;
  return Object.entries(route.query).every(([key, expected]) => {
    const actual = params.get(key);
    if (expected === true) {
      return actual === 'true' || actual === '1';
    }
    if (expected === false) {
      return actual === 'false' || actual === '0' || actual === null;
    }
    return actual === String(expected);
  });
}

function matchHeaders(route: DatasetRoute, headers: NormalizedHeaders): boolean {
  if (!route.headers_required) return true;
  return Object.entries(route.headers_required).every(([key, value]) => headers[key.toLowerCase()] === value);
}

function pickRoute(
  routes: DatasetRoute[],
  variant: string | undefined,
  params: URLSearchParams,
  headers: NormalizedHeaders,
): DatasetRoute | undefined {
  const variantKey = variant?.toLowerCase();
  const ordered = routes.reduce<DatasetRoute[]>((acc, route) => {
    if (route.variant) {
      if (variantKey && route.variant.toLowerCase() === variantKey) {
        acc.unshift(route);
      } else {
        acc.push(route);
      }
    } else {
      acc.push(route);
    }
    return acc;
  }, []);

  for (const route of ordered) {
    if (route.variant && variantKey && route.variant.toLowerCase() !== variantKey) {
      continue;
    }
    if (!matchQuery(route, params)) continue;
    if (!matchHeaders(route, headers)) continue;
    return route;
  }

  if (variantKey) {
    return routes.find((route) => !route.variant && matchQuery(route, params) && matchHeaders(route, headers));
  }

  return undefined;
}

function parseRequest(req: IncomingMessage) {
  const headers = normalizeHeaders(req.headers);
  const url = new URL(req.url ?? '', `http://${headers.host ?? 'localhost'}`);
  const params = url.searchParams;
  const variant = params.get('__variant') ?? headers['x-mock-variant'];
  const forceStatus = headers['x-force-status'];
  return { headers, params, variant: variant ?? undefined, forceStatus: forceStatus ? Number(forceStatus) : undefined };
}

function respond(res: ServerResponse, status: number, body: unknown) {
  res.setHeader('Content-Type', 'application/json');
  res.statusCode = status;
  res.end(JSON.stringify(body));
}

export function loadDatasetMocks(): MockMethod[] {
  const raw = fs.readFileSync(DATASET_PATH, 'utf-8');
  const dataset = JSON.parse(raw) as Dataset;
  const groups = new Map<string, DatasetRoute[]>();

  dataset.routes.forEach((route) => {
    const key = `${route.method.toUpperCase()} ${route.path}`;
    const list = groups.get(key) ?? [];
    list.push({ ...route, method: route.method.toUpperCase() });
    groups.set(key, list);
  });

  const mocks: MockMethod[] = [];

  groups.forEach((routes, key) => {
    const [method, url] = key.split(' ');
    mocks.push({
      url,
      method: method.toLowerCase() as MockMethod['method'],
      rawResponse: async (req, res) => {
        const { headers, params, variant, forceStatus } = parseRequest(req);
        if (forceStatus) {
          respond(res, forceStatus, {
            code: Number(`${forceStatus}01`),
            message: 'Forced status from X-Force-Status',
            data: null,
          });
          return;
        }

        const matched = pickRoute(routes, variant, params, headers);
        if (!matched) {
          respond(res, 404, { code: 40400, message: 'Mock route not found', data: null });
          return;
        }

        const delay = Number(params.get('__delay') ?? headers['x-mock-delay'] ?? 0);
        if (delay > 0) {
          await new Promise((resolve) => setTimeout(resolve, delay));
        }

        respond(res, matched.status ?? 200, matched.response);
      },
    });
  });

  return mocks;
}
