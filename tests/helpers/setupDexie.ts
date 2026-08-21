/**
 * IndexedDB Test Harness Setup for Dexie.js & Pelipäivä
 * 
 * Sets up an in-memory IndexedDB environment in Node.js (via fake-indexeddb
 * or built-in in-memory IDB polyfill) and provides isolated database helpers.
 */

import Dexie, { DexieOptions } from 'dexie';

// --- In-Memory IndexedDB Polyfill for Node.js Vitest Runner ---

interface StoredRecord {
  key: any;
  value: any;
}

class InMemoryKeyRange {
  lower: any;
  upper: any;
  lowerOpen: boolean;
  upperOpen: boolean;

  constructor(lower: any, upper: any, lowerOpen = false, upperOpen = false) {
    this.lower = lower;
    this.upper = upper;
    this.lowerOpen = lowerOpen;
    this.upperOpen = upperOpen;
  }

  static only(value: any): InMemoryKeyRange {
    return new InMemoryKeyRange(value, value, false, false);
  }

  static lowerBound(bound: any, open = false): InMemoryKeyRange {
    return new InMemoryKeyRange(bound, undefined, open, false);
  }

  static upperBound(bound: any, open = false): InMemoryKeyRange {
    return new InMemoryKeyRange(undefined, bound, false, open);
  }

  static bound(lower: any, upper: any, lowerOpen = false, upperOpen = false): InMemoryKeyRange {
    return new InMemoryKeyRange(lower, upper, lowerOpen, upperOpen);
  }

  includes(key: any): boolean {
    if (this.lower !== undefined) {
      if (this.lowerOpen ? key <= this.lower : key < this.lower) return false;
    }
    if (this.upper !== undefined) {
      if (this.upperOpen ? key >= this.upper : key > this.upper) return false;
    }
    return true;
  }
}

class DOMStringListMock extends Array<string> {
  contains(str: string): boolean {
    return this.includes(str);
  }
  item(index: number): string | null {
    return this[index] || null;
  }
}

class MockIDBRequest extends EventTarget {
  result: any = undefined;
  error: DOMException | null = null;
  source: any = null;
  transaction: any = null;
  readyState: 'pending' | 'done' = 'pending';
  onsuccess: ((e: any) => void) | null = null;
  onerror: ((e: any) => void) | null = null;

  _resolve(val: any) {
    this.result = val;
    this.readyState = 'done';
    const evt = { type: 'success', target: this, currentTarget: this };
    if (this.onsuccess) this.onsuccess(evt);
    this.dispatchEvent(new Event('success'));
  }

  _reject(err: any) {
    this.error = err instanceof DOMException ? err : new DOMException(String(err), 'UnknownError');
    this.readyState = 'done';
    const evt = { type: 'error', target: this, currentTarget: this };
    if (this.onerror) this.onerror(evt);
    this.dispatchEvent(new Event('error'));
  }
}

class MockIDBOpenDBRequest extends MockIDBRequest {
  onupgradeneeded: ((e: any) => void) | null = null;
  onblocked: ((e: any) => void) | null = null;
}

class MockIDBTransaction extends EventTarget {
  db: MockIDBDatabase;
  mode: 'readonly' | 'readwrite' | 'versionchange';
  error: DOMException | null = null;
  oncomplete: ((e: any) => void) | null = null;
  onerror: ((e: any) => void) | null = null;
  onabort: ((e: any) => void) | null = null;
  private _pendingCount = 0;
  private _completed = false;
  private _hasHadRequests = false;
  private _snapshots = new Map<string, Map<any, StoredRecord>>();

  constructor(db: MockIDBDatabase, mode: 'readonly' | 'readwrite' | 'versionchange') {
    super();
    this.db = db;
    this.mode = mode;
  }

  get objectStoreNames(): DOMStringListMock {
    const list = new DOMStringListMock();
    list.push(...this.db._stores.keys());
    return list;
  }

  objectStore(name: string): MockIDBObjectStore {
    const store = this.db._stores.get(name);
    if (!store) {
      throw new DOMException(`NotFoundError: The specified object store was not found: ${name}`, 'NotFoundError');
    }
    if ((this.mode === 'readwrite' || this.mode === 'versionchange') && !this._snapshots.has(name)) {
      this._snapshots.set(name, new Map(store.records));
    }
    return new MockIDBObjectStore(store, this);
  }

  abort() {
    this._completed = true;
    for (const [storeName, snapshot] of this._snapshots.entries()) {
      const store = this.db._stores.get(storeName);
      if (store) {
        store.records = new Map(snapshot);
      }
    }
    const evt = { type: 'abort', target: this, currentTarget: this };
    if (this.onabort) this.onabort(evt);
    this.dispatchEvent(new Event('abort'));
  }

  commit() {
    this._hasHadRequests = true;
    if (this._pendingCount === 0 && !this._completed) {
      this._completed = true;
      const evt = { type: 'complete', target: this, currentTarget: this };
      if (this.oncomplete) this.oncomplete(evt);
      this.dispatchEvent(new Event('complete'));
    }
  }

  _trackRequest(req: MockIDBRequest) {
    this._hasHadRequests = true;
    this._pendingCount++;
    const finish = () => {
      this._pendingCount--;
      this._checkCompletion();
    };
    req.addEventListener('success', finish, { once: true });
    req.addEventListener('error', finish, { once: true });
  }

  _checkCompletion() {
    if (this._pendingCount === 0 && !this._completed && this._hasHadRequests) {
      setTimeout(() => {
        if (this._pendingCount === 0 && !this._completed && this._hasHadRequests) {
          this._completed = true;
          const evt = { type: 'complete', target: this, currentTarget: this };
          if (this.oncomplete) this.oncomplete(evt);
          this.dispatchEvent(new Event('complete'));
        }
      }, 10);
    }
  }
}

class MockIDBIndex {
  name: string;
  keyPath: string | string[];
  multiEntry: boolean;
  unique: boolean;
  objectStore: MockIDBObjectStore;
  private _dataStore: StoreInternal;

  constructor(name: string, keyPath: string | string[], options: IDBIndexParameters | undefined, store: MockIDBObjectStore, dataStore: StoreInternal) {
    this.name = name;
    this.keyPath = keyPath;
    this.multiEntry = options?.multiEntry ?? false;
    this.unique = options?.unique ?? false;
    this.objectStore = store;
    this._dataStore = dataStore;
  }

  private _extractKey(obj: any): any {
    if (Array.isArray(this.keyPath)) {
      return this.keyPath.map(k => obj?.[k]);
    }
    return obj?.[this.keyPath as string];
  }

  get(query: any): MockIDBRequest {
    const req = new MockIDBRequest();
    req.transaction = this.objectStore.transaction;
    this.objectStore.transaction._trackRequest(req);
    queueMicrotask(() => {
      for (const rec of this._dataStore.records.values()) {
        const valKey = this._extractKey(rec.value);
        if (this._matches(valKey, query)) {
          req._resolve(rec.value);
          return;
        }
      }
      req._resolve(undefined);
    });
    return req;
  }

  getAll(query?: any, count?: number): MockIDBRequest {
    const req = new MockIDBRequest();
    req.transaction = this.objectStore.transaction;
    this.objectStore.transaction._trackRequest(req);
    queueMicrotask(() => {
      const results: any[] = [];
      for (const rec of this._dataStore.records.values()) {
        if (count && results.length >= count) break;
        const valKey = this._extractKey(rec.value);
        if (query === undefined || this._matches(valKey, query)) {
          results.push(rec.value);
        }
      }
      req._resolve(results);
    });
    return req;
  }

  getAllKeys(query?: any, count?: number): MockIDBRequest {
    const req = new MockIDBRequest();
    req.transaction = this.objectStore.transaction;
    this.objectStore.transaction._trackRequest(req);
    queueMicrotask(() => {
      const results: any[] = [];
      for (const rec of this._dataStore.records.values()) {
        if (count && results.length >= count) break;
        const valKey = this._extractKey(rec.value);
        if (query === undefined || this._matches(valKey, query)) {
          results.push(rec.key);
        }
      }
      req._resolve(results);
    });
    return req;
  }

  count(query?: any): MockIDBRequest {
    const req = new MockIDBRequest();
    req.transaction = this.objectStore.transaction;
    this.objectStore.transaction._trackRequest(req);
    queueMicrotask(() => {
      let c = 0;
      for (const rec of this._dataStore.records.values()) {
        const valKey = this._extractKey(rec.value);
        if (query === undefined || this._matches(valKey, query)) {
          c++;
        }
      }
      req._resolve(c);
    });
    return req;
  }

  openCursor(query?: any, direction: IDBCursorDirection = 'next'): MockIDBRequest {
    const req = new MockIDBRequest();
    req.transaction = this.objectStore.transaction;
    this.objectStore.transaction._trackRequest(req);
    queueMicrotask(() => {
      const matching: StoredRecord[] = [];
      for (const rec of this._dataStore.records.values()) {
        const valKey = this._extractKey(rec.value);
        if (query === undefined || this._matches(valKey, query)) {
          matching.push(rec);
        }
      }
      if (matching.length === 0) {
        req._resolve(null);
        return;
      }
      let idx = 0;
      const cursor = {
        get key() { return matching[idx].key; },
        get primaryKey() { return matching[idx].key; },
        get value() { return matching[idx].value; },
        direction,
        update: (newValue: any) => {
          return this.objectStore.put(newValue);
        },
        delete: () => {
          return this.objectStore.delete(matching[idx].key);
        },
        continue: () => {
          idx++;
          if (idx < matching.length) {
            req._resolve(cursor);
          } else {
            req._resolve(null);
          }
        },
        advance: (count: number) => {
          idx += count;
          if (idx < matching.length) {
            req._resolve(cursor);
          } else {
            req._resolve(null);
          }
        }
      };
      req._resolve(cursor);
    });
    return req;
  }

  private _matches(itemKey: any, query: any): boolean {
    if (query instanceof InMemoryKeyRange) {
      return query.includes(itemKey);
    }
    if (Array.isArray(query) && Array.isArray(itemKey)) {
      return query.length === itemKey.length && query.every((v, i) => v === itemKey[i]);
    }
    return itemKey === query;
  }
}

interface StoreInternal {
  name: string;
  keyPath: string | string[] | null;
  autoIncrement: boolean;
  autoKey: number;
  records: Map<any, StoredRecord>;
  indices: Map<string, { name: string; keyPath: string | string[]; options?: IDBIndexParameters }>;
}

class MockIDBObjectStore {
  private _internal: StoreInternal;
  transaction: MockIDBTransaction;

  constructor(internal: StoreInternal, transaction: MockIDBTransaction) {
    this._internal = internal;
    this.transaction = transaction;
  }

  get name() { return this._internal.name; }
  get keyPath() { return this._internal.keyPath; }
  get autoIncrement() { return this._internal.autoIncrement; }
  get indexNames(): DOMStringListMock {
    const list = new DOMStringListMock();
    list.push(...this._internal.indices.keys());
    return list;
  }

  createIndex(name: string, keyPath: string | string[], options?: IDBIndexParameters): MockIDBIndex {
    this._internal.indices.set(name, { name, keyPath, options });
    return new MockIDBIndex(name, keyPath, options, this, this._internal);
  }

  index(name: string): MockIDBIndex {
    const idxDef = this._internal.indices.get(name);
    if (!idxDef) {
      throw new DOMException(`NotFoundError: Index ${name} not found`, 'NotFoundError');
    }
    return new MockIDBIndex(idxDef.name, idxDef.keyPath, idxDef.options, this, this._internal);
  }

  deleteIndex(name: string) {
    this._internal.indices.delete(name);
  }

  private _extractKey(value: any, explicitKey?: any): any {
    if (explicitKey !== undefined) return explicitKey;
    if (this._internal.keyPath) {
      if (Array.isArray(this._internal.keyPath)) {
        return this._internal.keyPath.map(k => value?.[k]);
      }
      return value?.[this._internal.keyPath];
    }
    if (this._internal.autoIncrement) {
      return ++this._internal.autoKey;
    }
    throw new DOMException('DataError: No key provided and no key generator', 'DataError');
  }

  put(value: any, key?: any): MockIDBRequest {
    const req = new MockIDBRequest();
    req.transaction = this.transaction;
    this.transaction._trackRequest(req);
    queueMicrotask(() => {
      try {
        const resolvedKey = this._extractKey(value, key);
        this._internal.records.set(this._serializeKey(resolvedKey), { key: resolvedKey, value });
        req._resolve(resolvedKey);
      } catch (e) {
        req._reject(e);
      }
    });
    return req;
  }

  add(value: any, key?: any): MockIDBRequest {
    const req = new MockIDBRequest();
    req.transaction = this.transaction;
    this.transaction._trackRequest(req);
    queueMicrotask(() => {
      try {
        const resolvedKey = this._extractKey(value, key);
        const serialized = this._serializeKey(resolvedKey);
        if (this._internal.records.has(serialized)) {
          req._reject(new DOMException('ConstraintError: Key already exists', 'ConstraintError'));
          return;
        }
        this._internal.records.set(serialized, { key: resolvedKey, value });
        req._resolve(resolvedKey);
      } catch (e) {
        req._reject(e);
      }
    });
    return req;
  }

  get(query: any): MockIDBRequest {
    const req = new MockIDBRequest();
    req.transaction = this.transaction;
    this.transaction._trackRequest(req);
    queueMicrotask(() => {
      const serialized = this._serializeKey(query);
      const rec = this._internal.records.get(serialized);
      req._resolve(rec ? rec.value : undefined);
    });
    return req;
  }

  getAll(query?: any, count?: number): MockIDBRequest {
    const req = new MockIDBRequest();
    req.transaction = this.transaction;
    this.transaction._trackRequest(req);
    queueMicrotask(() => {
      const results: any[] = [];
      for (const rec of this._internal.records.values()) {
        if (count && results.length >= count) break;
        if (query === undefined || query === null || this._matchesKey(rec.key, query)) {
          results.push(rec.value);
        }
      }
      req._resolve(results);
    });
    return req;
  }

  getAllKeys(query?: any, count?: number): MockIDBRequest {
    const req = new MockIDBRequest();
    req.transaction = this.transaction;
    this.transaction._trackRequest(req);
    queueMicrotask(() => {
      const results: any[] = [];
      for (const rec of this._internal.records.values()) {
        if (count && results.length >= count) break;
        if (query === undefined || query === null || this._matchesKey(rec.key, query)) {
          results.push(rec.key);
        }
      }
      req._resolve(results);
    });
    return req;
  }

  count(query?: any): MockIDBRequest {
    const req = new MockIDBRequest();
    req.transaction = this.transaction;
    this.transaction._trackRequest(req);
    queueMicrotask(() => {
      if (query === undefined || query === null) {
        req._resolve(this._internal.records.size);
      } else {
        let c = 0;
        for (const rec of this._internal.records.values()) {
          if (this._matchesKey(rec.key, query)) c++;
        }
        req._resolve(c);
      }
    });
    return req;
  }

  delete(query: any): MockIDBRequest {
    const req = new MockIDBRequest();
    req.transaction = this.transaction;
    this.transaction._trackRequest(req);
    queueMicrotask(() => {
      const serialized = this._serializeKey(query);
      this._internal.records.delete(serialized);
      req._resolve(undefined);
    });
    return req;
  }

  clear(): MockIDBRequest {
    const req = new MockIDBRequest();
    req.transaction = this.transaction;
    this.transaction._trackRequest(req);
    queueMicrotask(() => {
      this._internal.records.clear();
      req._resolve(undefined);
    });
    return req;
  }

  openCursor(query?: any, direction: IDBCursorDirection = 'next'): MockIDBRequest {
    const req = new MockIDBRequest();
    req.transaction = this.transaction;
    this.transaction._trackRequest(req);
    queueMicrotask(() => {
      const matching: StoredRecord[] = [];
      for (const rec of this._internal.records.values()) {
        if (query === undefined || query === null || this._matchesKey(rec.key, query)) {
          matching.push(rec);
        }
      }
      if (matching.length === 0) {
        req._resolve(null);
        return;
      }
      let idx = 0;
      const cursor = {
        get key() { return matching[idx]?.key; },
        get primaryKey() { return matching[idx]?.key; },
        get value() { return matching[idx]?.value; },
        direction,
        update: (newValue: any): MockIDBRequest => {
          const updateReq = new MockIDBRequest();
          updateReq.transaction = this.transaction;
          const rec = matching[idx];
          if (rec) {
            rec.value = newValue;
            const serialized = this._serializeKey(rec.key);
            this._internal.records.set(serialized, rec);
          }
          queueMicrotask(() => updateReq._resolve(rec?.key));
          return updateReq;
        },
        delete: (): MockIDBRequest => {
          const delReq = new MockIDBRequest();
          delReq.transaction = this.transaction;
          const rec = matching[idx];
          if (rec) {
            const serialized = this._serializeKey(rec.key);
            this._internal.records.delete(serialized);
          }
          queueMicrotask(() => delReq._resolve(undefined));
          return delReq;
        },
        continue: () => {
          idx++;
          queueMicrotask(() => {
            if (idx < matching.length) {
              req._resolve(cursor);
            } else {
              req._resolve(null);
            }
          });
        },
        advance: (count: number) => {
          idx += count;
          queueMicrotask(() => {
            if (idx < matching.length) {
              req._resolve(cursor);
            } else {
              req._resolve(null);
            }
          });
        }
      };
      req._resolve(cursor);
    });
    return req;
  }

  private _serializeKey(k: any): string {
    if (typeof k === 'object') return JSON.stringify(k);
    return String(k);
  }

  private _matchesKey(itemKey: any, query: any): boolean {
    if (query instanceof InMemoryKeyRange) {
      return query.includes(itemKey);
    }
    return this._serializeKey(itemKey) === this._serializeKey(query);
  }
}

class MockIDBDatabase extends EventTarget {
  name: string;
  version: number;
  _stores = new Map<string, StoreInternal>();

  constructor(name: string, version: number) {
    super();
    this.name = name;
    this.version = version;
  }

  get objectStoreNames(): DOMStringListMock {
    const list = new DOMStringListMock();
    list.push(...this._stores.keys());
    return list;
  }

  createObjectStore(name: string, options?: IDBObjectStoreParameters): MockIDBObjectStore {
    let internal = this._stores.get(name);
    if (!internal) {
      internal = {
        name,
        keyPath: options?.keyPath ?? null,
        autoIncrement: options?.autoIncrement ?? false,
        autoKey: 0,
        records: new Map(),
        indices: new Map()
      };
      this._stores.set(name, internal);
    } else {
      if (options?.keyPath !== undefined) internal.keyPath = options.keyPath;
      if (options?.autoIncrement !== undefined) internal.autoIncrement = options.autoIncrement;
    }
    const mockTx = new MockIDBTransaction(this, 'versionchange');
    return new MockIDBObjectStore(internal, mockTx);
  }

  deleteObjectStore(name: string) {
    this._stores.delete(name);
  }

  transaction(storeNames: string | string[], mode: IDBTransactionMode = 'readonly'): MockIDBTransaction {
    const txMode = mode as 'readonly' | 'readwrite' | 'versionchange';
    const tx = new MockIDBTransaction(this, txMode);
    return tx;
  }

  close() {}
}

class MockIDBFactory {
  private _databases = new Map<string, MockIDBDatabase>();

  open(name: string, version?: number): MockIDBOpenDBRequest {
    const req = new MockIDBOpenDBRequest();
    queueMicrotask(() => {
      let db = this._databases.get(name);
      const oldVersion = db ? db.version : 0;
      const targetVersion = version ?? (oldVersion || 1);

      if (!db) {
        db = new MockIDBDatabase(name, targetVersion);
        this._databases.set(name, db);
      }

      req.result = db;

      if (targetVersion > oldVersion) {
        db.version = targetVersion;
        const upgradeTx = new MockIDBTransaction(db, 'versionchange');
        req.transaction = upgradeTx;
        const upgradeEvt = {
          type: 'upgradeneeded',
          target: req,
          currentTarget: req,
          oldVersion,
          newVersion: targetVersion
        };
        if (req.onupgradeneeded) req.onupgradeneeded(upgradeEvt);
        req.dispatchEvent(new Event('upgradeneeded'));
        
        upgradeTx.addEventListener('complete', () => {
          if (req.readyState === 'pending') {
            req._resolve(db);
          }
        }, { once: true });

        // Trigger check if there were no requests, or schedule completion
        setTimeout(() => {
          if (req.readyState === 'pending') {
            req._resolve(db);
          }
        }, 50);
      } else {
        req._resolve(db);
      }
    });
    return req;
  }

  deleteDatabase(name: string): MockIDBOpenDBRequest {
    const req = new MockIDBOpenDBRequest();
    queueMicrotask(() => {
      this._databases.delete(name);
      req._resolve(undefined);
    });
    return req;
  }

  async databases(): Promise<{ name: string; version: number }[]> {
    const list: { name: string; version: number }[] = [];
    for (const db of this._databases.values()) {
      list.push({ name: db.name, version: db.version });
    }
    return list;
  }
}

// Instantiate and expose globals
const factory = new MockIDBFactory();
const keyRange = InMemoryKeyRange;

// @ts-ignore
globalThis.indexedDB = factory;
// @ts-ignore
globalThis.IDBKeyRange = keyRange;
// @ts-ignore
globalThis.IDBIndex = MockIDBIndex;
// @ts-ignore
globalThis.IDBObjectStore = MockIDBObjectStore;
// @ts-ignore
globalThis.IDBTransaction = MockIDBTransaction;
// @ts-ignore
globalThis.IDBDatabase = MockIDBDatabase;
// @ts-ignore
globalThis.IDBRequest = MockIDBRequest;
// @ts-ignore
globalThis.IDBOpenDBRequest = MockIDBOpenDBRequest;

// Configure Dexie dependencies
Dexie.dependencies.indexedDB = factory as any;
Dexie.dependencies.IDBKeyRange = keyRange as any;

// Now import PelipaivaDB after Dexie dependencies are initialized
import { PelipaivaDB } from '../../src/lib/storage/db';

/**
 * Creates an isolated, in-memory test database for Pelipäivä.
 */
export function createTestDb(name?: string, options?: DexieOptions): PelipaivaDB {
  const dbName = name || `test_db_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  return new PelipaivaDB(dbName, {
    indexedDB: factory as any,
    IDBKeyRange: keyRange as any,
    ...options
  });
}

/**
 * Clears all records from all tables in the given test database.
 */
export async function clearTestDb(testDb: PelipaivaDB): Promise<void> {
  const tables = testDb.tables;
  for (const table of tables) {
    await table.clear();
  }
}

/**
 * Closes and deletes the test database.
 */
export async function deleteTestDb(testDb: PelipaivaDB): Promise<void> {
  testDb.close();
  await testDb.delete();
}
