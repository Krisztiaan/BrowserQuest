import { createResourceKey } from './resources';
import type { FixedClock } from './clock';
import type { XorShift32 } from './rng';

export const RNG_RESOURCE = createResourceKey<XorShift32>('rng');
export const CLOCK_RESOURCE = createResourceKey<FixedClock>('clock');

