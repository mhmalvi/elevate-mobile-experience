/**
 * Makes a hand-rolled Supabase query-builder mock awaitable at any point in
 * the chain.
 *
 * WHY
 * ---
 * The query hooks build a query and then conditionally narrow it *after* the
 * terminal-looking call:
 *
 *     let query = supabase.from('clients')
 *       .select('*', { count: 'exact' })
 *       .is('deleted_at', null)
 *       .order('name')
 *       .range(from, to);
 *
 *     if (team?.id) query = query.eq('team_id', team.id);   // <-- after range()
 *     else          query = query.eq('user_id', user.id);
 *
 *     const { data, count, error } = await query;
 *
 * The test mocks resolve on `.range()` and return `this` from `.eq()`, which was
 * correct when `.eq()` came first. Once team scoping moved `.eq()` to the end,
 * `await query` awaited a plain object instead of the fixture, so `data`,
 * `count` and `error` all came back undefined and the assertions timed out.
 *
 * Rather than reorder every mock to match the current call order — which would
 * break again the next time the hooks are refactored — this makes the chain
 * object itself thenable. Awaiting it at ANY point yields the fixture, so the
 * mocks stop being coupled to the order the hook happens to apply filters in.
 *
 * The resolved value is read via `getMockImplementation()` and invoked
 * directly, which does NOT register a call on the mock — so assertions like
 * `expect(chain.eq).toHaveBeenCalledWith(...)` are unaffected.
 */
export function thenable<T extends Record<string, any>>(chain: T): T {
  // Ordered by how likely each is to be the resolving call in these hooks.
  const candidates = [
    'range', 'limit', 'single', 'maybeSingle',
    'order', 'select', 'eq', 'is', 'in', 'ilike',
  ];

  for (const name of candidates) {
    const fn = chain[name];
    const impl = typeof fn?.getMockImplementation === 'function'
      ? fn.getMockImplementation()
      : undefined;
    if (!impl) continue;

    let value: unknown;
    try {
      // Invoking the implementation directly does NOT record a call, so
      // `expect(chain.range).toHaveBeenCalledWith(...)` still behaves.
      value = impl();
    } catch {
      continue; // e.g. mockReturnThis() invoked without a `this`
    }

    if (!value || typeof (value as any).then !== 'function') continue;

    // The resolving method must ALSO stay chainable. `.range()` previously
    // returned the promise, so the hook's trailing
    //     if (team?.id) query = query.eq('team_id', …)
    // blew up with "query.eq is not a function" and the queryFn rejected —
    // which is why these suites timed out waiting for isSuccess.
    // Re-point it at the chain and expose the value through `then` instead.
    fn.mockReturnValue(chain);

    Object.defineProperty(chain, 'then', {
      value: (onFulfilled: any, onRejected: any) =>
        (value as Promise<unknown>).then(onFulfilled, onRejected),
      writable: true,
      configurable: true,
      enumerable: false, // keep it out of spread/inspection in assertions
    });
    return chain;
  }

  // No resolving method found — return untouched so the failure surfaces in the
  // test rather than being masked here.
  return chain;
}
