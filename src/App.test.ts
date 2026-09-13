import { describe, expect, it } from 'vitest';
import { DEFAULT_VIEW_MODE } from './App';

describe('App defaults', () => {
  it('opens timeline view by default', () => {
    expect(DEFAULT_VIEW_MODE).toBe('timeline');
  });
});
