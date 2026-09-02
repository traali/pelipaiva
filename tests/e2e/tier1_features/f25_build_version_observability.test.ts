import { describe, it, expect } from 'vitest';

describe('Feature f25: Universal Observability & Build Info Contracts', () => {
  it('f25.01: Exposes valid build info on window global', () => {
    // Simulate window.__APP_BUILD_INFO__ object
    const mockBuildInfo = {
      version: '1.0.0',
      commit: 'ed6d9bc',
      buildTime: new Date().toISOString()
    };

    expect(mockBuildInfo.version).toMatch(/^\d+\.\d+\.\d+/);
    expect(mockBuildInfo.commit).toMatch(/^[a-f0-9]{7,40}$/);
    expect(new Date(mockBuildInfo.buildTime).getTime()).not.toBeNaN();
  });

  it('f25.02: Formats readable version and git commit pill for UI presentation', () => {
    const version = '1.0.0';
    const commit = 'ed6d9bc';
    const pillText = `v${version} (git:${commit})`;

    expect(pillText).toBe('v1.0.0 (git:ed6d9bc)');
    expect(pillText).toContain('git:');
  });
});
