import { createResourceKey } from '../../ecs/resources';
import type { ClaimsStore } from './claims-store';

export const CLAIMS_STORE_RESOURCE = createResourceKey<ClaimsStore>('claims_store');

