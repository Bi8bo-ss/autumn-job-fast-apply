export function resolve(specifier, context, nextResolve) {
  if (specifier === 'cloudflare:workers') return { url: 'data:text/javascript,export const env = { OPENAI_API_KEY: "fixture-key-never-sent", OPENAI_MODEL: "fixture-model" };', shortCircuit: true };
  return nextResolve(specifier, context);
}
