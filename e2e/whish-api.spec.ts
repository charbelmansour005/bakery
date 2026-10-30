import { expect, test } from '@playwright/test';
import { normaliseBaseUrl, resolveMode } from '../lib/whish-api';

// Pure functions: no browser and no server, so these run in both passes.
test.describe('Whish base URL handling', () => {
  test('a base URL typed without https:// is repaired, with or without a trailing slash', () => {
    const expected = 'https://partner.api.sbx.whish.money/itel-service/api';
    expect(normaliseBaseUrl('partner.api.sbx.whish.money/itel-service/api')).toBe(expected);
    expect(normaliseBaseUrl('  https://partner.api.sbx.whish.money/itel-service/api/  ')).toBe(expected);
    expect(normaliseBaseUrl('http://localhost:4010')).toBe('http://localhost:4010');
  });

  test('the mode is whatever WHISH_MODE says, and only otherwise guessed from the address', () => {
    const sbx = 'partner.api.sbx.whish.money/itel-service/api';
    // The guess cannot recognise this test host — which is why WHISH_MODE exists.
    expect(resolveMode(sbx)).toBe('live');
    expect(resolveMode(sbx, 'test')).toBe('test');
    expect(resolveMode('https://whish.money/itel-service/api', 'TEST')).toBe('test');
    expect(resolveMode('http://localhost:4010')).toBe('test');
    expect(resolveMode('https://whish.money/itel-service/api', 'nonsense')).toBe('live');
  });
});
