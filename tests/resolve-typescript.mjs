import { existsSync } from 'node:fs';

// Match the app's @/ alias and extensionless TS imports using Node's type
// stripping, without installing a separate test runtime.
export function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('@/') || specifier.startsWith('.')) {
    const url = specifier.startsWith('@/')
      ? new URL(`../${specifier.slice(2)}`, import.meta.url)
      : new URL(specifier, context.parentURL);
    if (url.protocol === 'file:' && !existsSync(url) && existsSync(new URL(`${url.href}.ts`))) {
      return nextResolve(`${url.href}.ts`, context);
    }
    if (specifier.startsWith('@/')) return nextResolve(url.href, context);
  }
  return nextResolve(specifier, context);
}
