/**
 * 配列を指定した条件でグループ化し、それぞれの件数を集計します。
 */
export function countBy<T, K extends PropertyKey>(
  iterable: Iterable<T> | null | undefined,
  callbackFn: (element: T, index: number) => K | null | undefined,
): Record<K | 'undefined', number> {
  if (!iterable) return {} as Record<K | 'undefined', number>;

  const grouped = Object.groupBy(iterable, (element, index) => {
    const key = callbackFn(element, index);
    return key ?? 'undefined';
  }) as Record<PropertyKey, T[] | undefined>;

  return Object.fromEntries(Object.entries(grouped).map(([key, value]) => [key, value?.length ?? 0])) as Record<K | 'undefined', number>;
}

/**
 * 配列の各要素に含まれる内包配列を展開し、中身のアイテムの登場回数をオブジェクト形式で集計します。
 */
export function countNestedBy<T, I extends PropertyKey>(
  iterable: Iterable<T> | null | undefined,
  getItemsFn: (element: T) => Iterable<I | null | undefined> | null | undefined,
): Record<I | 'undefined', number> {
  if (!iterable) return {} as Record<I | 'undefined', number>;

  const acc = new Map<I | 'undefined', number>();

  for (const element of iterable) {
    const items = getItemsFn(element) ?? [];
    for (const item of items) {
      const key = item ?? 'undefined';
      const currentCount = acc.get(key) || 0;
      acc.set(key, currentCount + 1);
    }
  }

  return Object.fromEntries(acc.entries()) as Record<I | 'undefined', number>;
}
