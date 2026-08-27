export {};

declare global {
  var litIssuedWarnings: Set<string> | undefined;
}

// Lit prints "Lit is in dev mode..." once per module-graph instance it's
// imported into — and since vitest gives each test *file* its own isolated
// globalThis by default, that's once per file that (transitively) imports
// lit, not once per whole test run. It's not indicating anything wrong;
// it's meant for actual browser development, not test output. Confirmed
// against Lit's own maintainers' documented workaround for this exact
// situation (lit/lit#4877): pre-seed the warning as already-issued before
// any lit import happens, so its own warn-once logic skips it. This has to
// run before lit is ever imported, which is why it's a vitest `setupFiles`
// entry (runs first, per test file) rather than living in a regular test.
globalThis.litIssuedWarnings ??= new Set();
globalThis.litIssuedWarnings.add('Lit is in dev mode. Not recommended for production! See https://lit.dev/msg/dev-mode for more information.');
