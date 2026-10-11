/** Creates an element with a class name and optional text. */
export function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  text?: string
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  node.className = className
  if (text !== undefined) node.textContent = text
  return node
}

/** Translates a key of `translations/nb.json`, with optional `{name}` style variables. */
export type Translate = (key: string, variables?: Record<string, string | number>) => string
