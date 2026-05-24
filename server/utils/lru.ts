/**
 * LruMap — 삽입 순서 기반 간단 LRU 캐시.
 *
 * JS Map은 삽입 순서를 보존하므로, 용량 초과 시 가장 먼저 삽입된(=가장 오래된) 키를
 * 제거한다. get() 호출 시 해당 키를 다시 삽입해 "최근 사용"으로 갱신한다.
 *
 * Map과 동일한 has/get/set/delete API를 제공해 기존 `new Map()` 캐시를 그대로 대체 가능.
 */
export class LruMap<K, V> {
  private readonly map = new Map<K, V>();

  constructor(private readonly maxSize: number) {
    if (maxSize <= 0) throw new Error("LruMap maxSize는 1 이상이어야 합니다.");
  }

  has(key: K): boolean {
    return this.map.has(key);
  }

  get(key: K): V | undefined {
    const val = this.map.get(key);
    if (val !== undefined && this.map.delete(key)) {
      this.map.set(key, val); // 최근 사용으로 재배치
    }
    return val;
  }

  set(key: K, value: V): this {
    if (this.map.has(key)) this.map.delete(key);
    this.map.set(key, value);
    if (this.map.size > this.maxSize) {
      const oldest = this.map.keys().next().value;
      if (oldest !== undefined) this.map.delete(oldest);
    }
    return this;
  }

  delete(key: K): boolean {
    return this.map.delete(key);
  }

  get size(): number {
    return this.map.size;
  }
}
