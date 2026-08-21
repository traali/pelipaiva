/**
 * Fixture Loader Helper for Pelipäivä E2E Test Suite
 * 
 * Provides synchronous file loading utilities for ICS calendar feeds,
 * sports association HTML team pages, and JSON mock datasets.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

export type FixtureCategory = 'ics' | 'html' | 'json';

const FIXTURES_ROOT = path.resolve(__dirname, '../fixtures');

/**
 * Returns the absolute path to a fixture file within the specified category.
 */
export function getFixturePath(category: FixtureCategory, filename: string): string {
  const ext = category === 'ics' ? '.ics' : category === 'html' ? '.html' : '.json';
  const resolvedName = filename.endsWith(ext) ? filename : `${filename}${ext}`;
  return path.join(FIXTURES_ROOT, category, resolvedName);
}

/**
 * Loads an ICS calendar feed fixture as a string.
 */
export function loadFixtureIcs(filename: string): string {
  const filePath = getFixturePath('ics', filename);
  if (!fs.existsSync(filePath)) {
    throw new Error(`[FixtureLoader] ICS fixture not found: ${filePath}`);
  }
  return fs.readFileSync(filePath, 'utf-8');
}

/**
 * Loads an HTML team page fixture as a string.
 */
export function loadFixtureHtml(filename: string): string {
  const filePath = getFixturePath('html', filename);
  if (!fs.existsSync(filePath)) {
    throw new Error(`[FixtureLoader] HTML fixture not found: ${filePath}`);
  }
  return fs.readFileSync(filePath, 'utf-8');
}

/**
 * Loads and parses a JSON dataset fixture.
 */
export function loadFixtureJson<T = any>(filename: string): T {
  const filePath = getFixturePath('json', filename);
  if (!fs.existsSync(filePath)) {
    throw new Error(`[FixtureLoader] JSON fixture not found: ${filePath}`);
  }
  const content = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(content) as T;
}

// Convenient aliases
export const loadIcsFixture = loadFixtureIcs;
export const loadHtmlFixture = loadFixtureHtml;
export const loadJsonFixture = loadFixtureJson;

/**
 * Lists all fixture filenames in a given category folder.
 */
export function listFixtures(category: FixtureCategory): string[] {
  const dirPath = path.join(FIXTURES_ROOT, category);
  if (!fs.existsSync(dirPath)) {
    return [];
  }
  return fs.readdirSync(dirPath).filter(f => !f.startsWith('.'));
}

/**
 * Loads all ICS fixtures in the fixtures/ics directory into a key-value record.
 */
export function loadAllIcsFixtures(): Record<string, string> {
  const files = listFixtures('ics');
  const result: Record<string, string> = {};
  for (const file of files) {
    const key = path.basename(file, '.ics');
    result[key] = loadFixtureIcs(file);
  }
  return result;
}

/**
 * Loads all HTML fixtures in the fixtures/html directory into a key-value record.
 */
export function loadAllHtmlFixtures(): Record<string, string> {
  const files = listFixtures('html');
  const result: Record<string, string> = {};
  for (const file of files) {
    const key = path.basename(file, '.html');
    result[key] = loadFixtureHtml(file);
  }
  return result;
}

/**
 * Loads all JSON fixtures in the fixtures/json directory into a key-value record.
 */
export function loadAllJsonFixtures(): Record<string, any> {
  const files = listFixtures('json');
  const result: Record<string, any> = {};
  for (const file of files) {
    const key = path.basename(file, '.json');
    result[key] = loadFixtureJson(file);
  }
  return result;
}
