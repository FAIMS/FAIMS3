/**
 * @file Tests for the designer plan registry.
 */
import {describe, expect, it} from 'vitest';
import {createDesignerPlanRegistry, registerDesignerPlanType} from './plans';

const definition = (planType: string) => ({
  planType,
  label: planType,
  description: 'test plan type',
  Dialog: () => null,
});

describe('registerDesignerPlanType', () => {
  it('registers a route-safe plan type', () => {
    const registry = createDesignerPlanRegistry();
    registerDesignerPlanType(definition('Counted'), registry);
    expect(registry.size).toBe(1);
  });

  it('rejects a second registration of one plan type', () => {
    const registry = createDesignerPlanRegistry();
    registerDesignerPlanType(definition('Counted'), registry);
    expect(() =>
      registerDesignerPlanType(definition('Counted'), registry)
    ).toThrow(/already registered/);
  });

  it('rejects a plan type that would not survive a route', () => {
    // Ids are minted from the type, so the designer holds the same rule as the
    // data-model registry rather than letting the save fail later.
    const registry = createDesignerPlanRegistry();
    expect(() =>
      registerDesignerPlanType(definition('lab/samples'), registry)
    ).toThrow(/cannot be registered/);
  });
});
