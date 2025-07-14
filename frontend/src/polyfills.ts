// Debug: Check initial state
console.log('Polyfills loading...');
console.log('Initial crypto:', typeof globalThis.crypto);
console.log('Initial require:', typeof (globalThis as any).require);

// Polyfill require for browser compatibility
if (typeof (globalThis as any).require === 'undefined') {
  (globalThis as any).require = (module: string) => {
    // Handle common Node.js modules used in Solana projects
    switch (module) {
      case 'crypto':
        return globalThis.crypto || {
          getRandomValues: (array: any) => {
            for (let i = 0; i < array.length; i++) {
              array[i] = Math.floor(Math.random() * 256);
            }
            return array;
          },
          randomBytes: (size: number) => {
            const array = new Uint8Array(size);
            for (let i = 0; i < size; i++) {
              array[i] = Math.floor(Math.random() * 256);
            }
            return array;
          }
        };
      case 'buffer':
        return { Buffer: (globalThis as any).Buffer };
      case 'process':
        return (globalThis as any).process;
      case 'util':
        return (globalThis as any).util;
      case 'os':
        return (globalThis as any).os;
      case 'events':
        return (globalThis as any).events;
      case 'stream':
        return (globalThis as any).stream;
      case 'path':
        return (globalThis as any).path;
      case 'assert':
        // Return a minimal assert implementation
        return {
          ok: (value: any, message?: string) => {
            if (!value) throw new Error(message || 'Assertion failed');
          },
          equal: (actual: any, expected: any, message?: string) => {
            if (actual !== expected) throw new Error(message || `Expected ${expected}, got ${actual}`);
          },
          deepEqual: (actual: any, expected: any, message?: string) => {
            if (JSON.stringify(actual) !== JSON.stringify(expected)) {
              throw new Error(message || `Deep equality failed`);
            }
          }
        };
      default:
        // For other modules, throw a more helpful error
        console.warn(`Module '${module}' is not available in browser context. Consider using browser-compatible alternatives.`);
        throw new Error(`Module '${module}' is not available in browser context. Use browser-compatible alternatives.`);
    }
  };
}

// Also add to window for compatibility
if (typeof (window as any).require === 'undefined') {
  (window as any).require = (globalThis as any).require;
}

// Add __require alias that might be used by bundlers
if (typeof (globalThis as any).__require === 'undefined') {
  (globalThis as any).__require = (globalThis as any).require;
}

// Also add to window object
if (typeof (window as any).__require === 'undefined') {
  (window as any).__require = (globalThis as any).require;
}

// Simple Buffer polyfill that doesn't extend Uint8Array to avoid conflicts
const BufferPolyfill = (globalThis as any).Buffer || {
  from: (data: any, encoding?: string) => {
    if (typeof data === 'string') {
      const arr = new Uint8Array(data.length);
      for (let i = 0; i < data.length; i++) {
        arr[i] = data.charCodeAt(i);
      }
      return arr;
    }
    if (Array.isArray(data)) {
      return new Uint8Array(data);
    }
    return new Uint8Array(data);
  },
  
  alloc: (size: number) => {
    return new Uint8Array(size);
  },
  
  allocUnsafe: (size: number) => {
    return new Uint8Array(size);
  },
  
  isBuffer: (obj: any) => {
    return obj instanceof Uint8Array;
  },
  
  concat: (list: Uint8Array[], totalLength?: number) => {
    if (list.length === 0) return new Uint8Array(0);
    if (list.length === 1) return list[0];
    
    const length = totalLength || list.reduce((acc, buf) => acc + buf.length, 0);
    const result = new Uint8Array(length);
    let offset = 0;
    
    for (const buf of list) {
      result.set(buf, offset);
      offset += buf.length;
    }
    
    return result;
  }
};

// Polyfill global variables for browser
(globalThis as any).global = globalThis;
(globalThis as any).Buffer = BufferPolyfill;
(globalThis as any).process = {
  env: { DEBUG: undefined },
  version: '',
  nextTick: (fn: any) => setTimeout(fn, 0),
  browser: true,
  cwd: () => '/',
  chdir: () => {},
  umask: () => 0,
  hrtime: () => [0, 0],
  platform: 'browser',
  arch: 'x64',
  argv: [],
  execPath: '',
  pid: 1,
  ppid: 1,
  title: 'browser',
  stderr: { write: () => {} },
  stdout: { write: () => {} },
  stdin: { read: () => null },
  versions: { node: '16.0.0' },
  exit: () => {},
  kill: () => {},
  on: () => {},
  once: () => {},
  off: () => {},
  emit: () => {},
  prependListener: () => {},
  removeListener: () => {},
  removeAllListeners: () => {},
  setMaxListeners: () => {},
  getMaxListeners: () => 10,
  listeners: () => [],
  rawListeners: () => [],
  listenerCount: () => 0,
  eventNames: () => []
};

// Also set on window for compatibility
(window as any).global = globalThis;
(window as any).Buffer = BufferPolyfill;
(window as any).process = (globalThis as any).process;

// Polyfill util
(globalThis as any).util = {
  inherits: (ctor: any, superCtor: any) => {
    ctor.super_ = superCtor;
    ctor.prototype = Object.create(superCtor.prototype, {
      constructor: {
        value: ctor,
        enumerable: false,
        writable: true,
        configurable: true
      }
    });
  },
  isBuffer: (obj: any) => obj instanceof BufferPolyfill,
  isArray: Array.isArray,
  isString: (obj: any) => typeof obj === 'string',
  isObject: (obj: any) => obj !== null && typeof obj === 'object',
  isFunction: (obj: any) => typeof obj === 'function',
  isUndefined: (obj: any) => obj === undefined,
  isNull: (obj: any) => obj === null,
  isNullOrUndefined: (obj: any) => obj === null || obj === undefined,
  isNumber: (obj: any) => typeof obj === 'number',
  isBoolean: (obj: any) => typeof obj === 'boolean',
  isRegExp: (obj: any) => obj instanceof RegExp,
  isDate: (obj: any) => obj instanceof Date,
  isError: (obj: any) => obj instanceof Error,
  inspect: (obj: any) => JSON.stringify(obj, null, 2),
  format: (f: string, ...args: any[]) => {
    let i = 0;
    return f.replace(/%[sdj%]/g, (x: string) => {
      if (x === '%%') return '%';
      if (i >= args.length) return x;
      switch (x) {
        case '%s': return String(args[i++]);
        case '%d': return String(Number(args[i++]));
        case '%j':
          try {
            return JSON.stringify(args[i++]);
          } catch (_) {
            return '[Circular]';
          }
        default:
          return x;
      }
    });
  }
};

// Polyfill os
(globalThis as any).os = {
  platform: () => 'browser',
  arch: () => 'x64',
  release: () => '1.0.0',
  type: () => 'Browser',
  endianness: () => 'LE',
  hostname: () => 'localhost',
  tmpdir: () => '/tmp',
  homedir: () => '/home/user',
  userInfo: () => ({ username: 'user', uid: 1000, gid: 1000, shell: '/bin/bash', homedir: '/home/user' }),
  cpus: () => [{ model: 'Browser CPU', speed: 2000, times: { user: 0, nice: 0, sys: 0, idle: 0, irq: 0 } }],
  totalmem: () => 1024 * 1024 * 1024,
  freemem: () => 512 * 1024 * 1024,
  loadavg: () => [0.5, 0.5, 0.5],
  uptime: () => 3600,
  networkInterfaces: () => ({}),
  EOL: '\n'
};

// Polyfill crypto - avoid setting on window.crypto (read-only)
if (!globalThis.crypto) {
  // Only set if crypto doesn't exist at all
  (globalThis as any).crypto = {
    getRandomValues: (array: any) => {
      for (let i = 0; i < array.length; i++) {
        array[i] = Math.floor(Math.random() * 256);
      }
      return array;
    },
    randomBytes: (size: number) => {
      const array = new Uint8Array(size);
      for (let i = 0; i < size; i++) {
        array[i] = Math.floor(Math.random() * 256);
      }
      return array;
    }
  };
}

// Add missing methods to existing crypto object using defineProperty
if (globalThis.crypto && !(globalThis.crypto as any).randomBytes) {
  try {
    Object.defineProperty(globalThis.crypto, 'randomBytes', {
      value: (size: number) => {
        const array = new Uint8Array(size);
        globalThis.crypto.getRandomValues(array);
        return array;
      },
      writable: true,
      configurable: true
    });
  } catch (e) {
    // If we can't modify crypto, create a separate crypto object
    console.warn('Cannot modify native crypto object, creating separate crypto polyfill');
    (globalThis as any).cryptoPolyfill = {
      ...globalThis.crypto,
      randomBytes: (size: number) => {
        const array = new Uint8Array(size);
        globalThis.crypto.getRandomValues(array);
        return array;
      }
    };
  }
}

// Polyfill events
(globalThis as any).events = {
  EventEmitter: class EventEmitter {
    private _events: any = {};
    
    on(event: string, listener: Function) {
      if (!this._events[event]) this._events[event] = [];
      this._events[event].push(listener);
      return this;
    }
    
    once(event: string, listener: Function) {
      const onceListener = (...args: any[]) => {
        this.off(event, onceListener);
        listener(...args);
      };
      return this.on(event, onceListener);
    }
    
    off(event: string, listener: Function) {
      if (!this._events[event]) return this;
      this._events[event] = this._events[event].filter((l: Function) => l !== listener);
      return this;
    }
    
    emit(event: string, ...args: any[]) {
      if (!this._events[event]) return false;
      this._events[event].forEach((listener: Function) => listener(...args));
      return true;
    }
    
    removeAllListeners(event?: string) {
      if (event) {
        delete this._events[event];
      } else {
        this._events = {};
      }
      return this;
    }
  }
};

// Polyfill stream
(globalThis as any).stream = {
  Readable: class Readable {
    readable = true;
    read() { return null; }
    pipe(dest: any) { return dest; }
  },
  Writable: class Writable {
    writable = true;
    write() { return true; }
    end() { return this; }
  },
  Transform: class Transform {
    readable = true;
    writable = true;
    read() { return null; }
    write() { return true; }
    pipe(dest: any) { return dest; }
  }
};

// Polyfill path
(globalThis as any).path = {
  sep: '/',
  delimiter: ':',
  join: (...args: string[]) => args.join('/').replace(/\/+/g, '/'),
  resolve: (...args: string[]) => '/' + args.join('/').replace(/\/+/g, '/'),
  dirname: (path: string) => path.split('/').slice(0, -1).join('/') || '/',
  basename: (path: string) => path.split('/').pop() || '',
  extname: (path: string) => {
    const name = path.split('/').pop() || '';
    const lastDot = name.lastIndexOf('.');
    return lastDot > 0 ? name.substring(lastDot) : '';
  },
  isAbsolute: (path: string) => path.startsWith('/'),
  relative: (from: string, to: string) => to,
  normalize: (path: string) => path.replace(/\/+/g, '/')
};

console.log('Comprehensive polyfills loaded');
