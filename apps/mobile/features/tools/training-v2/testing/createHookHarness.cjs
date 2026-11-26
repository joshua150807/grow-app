// Minimal deterministic React hook runner for async feature regressions.
function createHookHarness(build) {
  const cells = [];
  const effects = [];
  let index = 0;
  let result;
  let props;
  const changed = (a, b) => !a || !b || a.length !== b.length || a.some((value, i) => value !== b[i]);
  const react = {
    useState(initial) {
      const i = index++;
      if (!cells[i]) cells[i] = { value: typeof initial === 'function' ? initial() : initial };
      return [cells[i].value, (next) => { cells[i].value = typeof next === 'function' ? next(cells[i].value) : next; }];
    },
    useRef(initial) {
      const i = index++;
      if (!cells[i]) cells[i] = { current: initial };
      return cells[i];
    },
    useCallback(callback, deps) {
      const i = index++;
      if (!cells[i] || changed(cells[i].deps, deps)) cells[i] = { deps, callback };
      return cells[i].callback;
    },
    useMemo(factory, deps) {
      const i = index++;
      if (!cells[i] || changed(cells[i].deps, deps)) cells[i] = { deps, value: factory() };
      return cells[i].value;
    },
    useEffect(effect, deps) {
      const i = index++;
      if (!cells[i] || changed(cells[i].deps, deps)) {
        const previous = cells[i];
        cells[i] = { deps, cleanup: previous?.cleanup };
        effects.push(() => { cells[i].cleanup?.(); cells[i].cleanup = effect(); });
      }
    },
  };
  const hook = build(react);
  function render(next = props) {
    props = next;
    index = 0;
    result = hook(props);
    effects.splice(0).forEach((effect) => effect());
    return result;
  }
  return {
    render,
    get result() { return result; },
    async settle() {
      for (let i = 0; i < 8; i += 1) { await new Promise(setImmediate); render(); }
      return result;
    },
    unmount() { cells.forEach((cell) => cell?.cleanup?.()); },
  };
}
module.exports = { createHookHarness };
