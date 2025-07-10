import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

// Polyfill Buffer and process for browser environment
import { Buffer } from 'buffer';
import process from 'process';
(window as any).global = window;
(window as any).Buffer = Buffer;
(window as any).process = process;

bootstrapApplication(App, appConfig)
  .catch((err) => console.error(err));
