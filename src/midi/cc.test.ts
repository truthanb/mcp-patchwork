import { describe, it, expect } from 'vitest';
import {
  normalizedToCC,
  ccToNormalized,
  clampNormalized,
  applyDelta,
} from './cc.js';

describe('normalizedToCC', () => {
  it('converts 0.0 to 0', () => {
    expect(normalizedToCC(0)).toBe(0);
  });

  it('converts 1.0 to 127', () => {
    expect(normalizedToCC(1)).toBe(127);
  });

  it('converts 0.5 to 64 (rounded)', () => {
    expect(normalizedToCC(0.5)).toBe(64);
  });

  it('clamps values above 1.0', () => {
    expect(normalizedToCC(1.5)).toBe(127);
  });

  it('clamps values below 0.0', () => {
    expect(normalizedToCC(-0.5)).toBe(0);
  });

  it('rounds correctly at boundaries', () => {
    // 0.504 * 127 = 64.008 -> 64
    expect(normalizedToCC(0.504)).toBe(64);
    // 0.508 * 127 = 64.516 -> 65
    expect(normalizedToCC(0.508)).toBe(65);
  });
});

describe('ccToNormalized', () => {
  it('converts 0 to 0.0', () => {
    expect(ccToNormalized(0)).toBe(0);
  });

  it('converts 127 to 1.0', () => {
    expect(ccToNormalized(127)).toBe(1);
  });

  it('converts 64 to approximately 0.504', () => {
    expect(ccToNormalized(64)).toBeCloseTo(0.504, 2);
  });

  it('clamps values above 127', () => {
    expect(ccToNormalized(200)).toBe(1);
  });

  it('clamps values below 0', () => {
    expect(ccToNormalized(-10)).toBe(0);
  });
});

describe('clampNormalized', () => {
  it('passes through valid values', () => {
    expect(clampNormalized(0.5)).toBe(0.5);
  });

  it('clamps to 0 at minimum', () => {
    expect(clampNormalized(-0.1)).toBe(0);
  });

  it('clamps to 1 at maximum', () => {
    expect(clampNormalized(1.1)).toBe(1);
  });

  it('preserves boundary values exactly', () => {
    expect(clampNormalized(0)).toBe(0);
    expect(clampNormalized(1)).toBe(1);
  });
});

describe('applyDelta', () => {
  it('applies positive delta', () => {
    expect(applyDelta(0.5, 0.2)).toBe(0.7);
  });

  it('applies negative delta', () => {
    expect(applyDelta(0.5, -0.2)).toBeCloseTo(0.3, 10);
  });

  it('clamps result to 1.0', () => {
    expect(applyDelta(0.8, 0.5)).toBe(1);
  });

  it('clamps result to 0.0', () => {
    expect(applyDelta(0.2, -0.5)).toBe(0);
  });

  it('handles zero delta', () => {
    expect(applyDelta(0.5, 0)).toBe(0.5);
  });
});
