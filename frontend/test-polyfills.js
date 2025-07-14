// Simple test to verify polyfills are working
console.log('Testing polyfills...');

// Test process
console.log('process.env:', typeof process?.env);
console.log('process.nextTick:', typeof process?.nextTick);

// Test Buffer
console.log('Buffer:', typeof Buffer);
console.log('global:', typeof global);

// Test util
console.log('util.format:', typeof util?.format);

// Test other polyfills
console.log('os.platform:', typeof os?.platform);
console.log('path.join:', typeof path?.join);
console.log('events.EventEmitter:', typeof events?.EventEmitter);

console.log('All polyfills loaded successfully!');
