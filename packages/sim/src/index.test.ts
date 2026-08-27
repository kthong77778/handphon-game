import { describe, expect, it } from 'vitest';
import { configVersion } from './index.js';

describe('workspace 배선', () => {
  it('sim 이 config 패키지를 참조한다', () => {
    expect(configVersion()).toBe(1);
  });
});
