/**
 * Null-safe DOM element lookups.
 *
 * Kept in a shared workspace package so every UI Resource under ui/ uses the
 * same contract: a missing element throws a descriptive error rather than
 * returning null/undefined (which would force consumers to use the non-null
 * assertion `!`, which is banned by project rules).
 */

export class ElementNotFoundError extends Error {
  constructor(selector: string) {
    super(`ui-bridge: element not found for selector "${selector}"`);
    this.name = "ElementNotFoundError";
  }
}

export class ElementTypeMismatchError extends Error {
  constructor(selector: string, expected: string, actual: string) {
    super(`ui-bridge: element at "${selector}" is not a ${expected} (got ${actual})`);
    this.name = "ElementTypeMismatchError";
  }
}

/**
 * Look up an element by ID and assert it matches the expected HTMLElement
 * subclass. Throws {@link ElementNotFoundError} if missing and
 * {@link ElementTypeMismatchError} if the tag type differs.
 */
export function getElement<T extends HTMLElement>(id: string, ctor: new () => T): T {
  const el = document.getElementById(id);
  if (el === null) {
    throw new ElementNotFoundError(`#${id}`);
  }
  if (!(el instanceof ctor)) {
    throw new ElementTypeMismatchError(`#${id}`, ctor.name, el.constructor.name);
  }
  return el;
}

/**
 * Query a single element under a parent and assert it matches the expected
 * HTMLElement subclass. Same error semantics as {@link getElement}.
 */
export function querySelector<T extends HTMLElement>(
  parent: ParentNode,
  selector: string,
  ctor: new () => T,
): T {
  const el = parent.querySelector(selector);
  if (el === null) {
    throw new ElementNotFoundError(selector);
  }
  if (!(el instanceof ctor)) {
    throw new ElementTypeMismatchError(selector, ctor.name, el.constructor.name);
  }
  return el;
}
