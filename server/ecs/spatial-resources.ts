import { createResourceKey } from './resources';
import type { InterestTracker } from './interest-tracker';
import type { SpatialIndex } from './spatial-index';

export const SPATIAL_INDEX_RESOURCE = createResourceKey<SpatialIndex>('spatial_index');
export const INTEREST_TRACKER_RESOURCE = createResourceKey<InterestTracker>('interest_tracker');
