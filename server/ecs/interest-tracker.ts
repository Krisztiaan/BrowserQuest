import { entityIdToWire, type EntityId } from '../../shared/domain/ids';

export type InterestDiff = Readonly<{
    enter: EntityId[];
    leave: EntityId[];
}>;

export class InterestTracker {
    #interestByObserver = new Map<EntityId, Set<EntityId>>();

    clearObserver(observerId: EntityId): void {
        this.#interestByObserver.delete(observerId);
    }

    update(observerId: EntityId, visible: ReadonlyArray<EntityId>, { excludeSelf = true } = {}): InterestDiff {
        const prev = this.#interestByObserver.get(observerId) ?? new Set<EntityId>();
        const next = new Set<EntityId>();

        for (let i = 0; i < visible.length; i += 1) {
            const id = visible[i];
            if (id === undefined) {
                continue;
            }
            if (excludeSelf && id === observerId) {
                continue;
            }
            next.add(id);
        }

        const enter: EntityId[] = [];
        const leave: EntityId[] = [];

        for (const id of next) {
            if (!prev.has(id)) {
                enter.push(id);
            }
        }
        for (const id of prev) {
            if (!next.has(id)) {
                leave.push(id);
            }
        }

        enter.sort((a, b) => entityIdToWire(a) - entityIdToWire(b));
        leave.sort((a, b) => entityIdToWire(a) - entityIdToWire(b));

        this.#interestByObserver.set(observerId, next);
        return { enter, leave };
    }
}
