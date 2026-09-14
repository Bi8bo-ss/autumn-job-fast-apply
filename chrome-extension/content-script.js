(() => {
  // The engine keeps the scan's element references in the isolated world.
  // Reinjection preserves them for this version and replaces stale engines
  // after an update, rather than silently continuing to run old code.
  if (!globalThis.__autumnFormEngine) throw new Error('表单引擎未加载，请重新识别');
  globalThis.__autumnApplyController = globalThis.__autumnFormEngine;
})();
