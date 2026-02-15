export type ScheduledJob<TPayload = unknown> = Readonly<{
    id: string;
    dueTick: number;
    payload: TPayload;
}>;

type HeapItem<TPayload> = Readonly<{
    id: string;
    dueTick: number;
    payload: TPayload;
    version: number;
    seq: number;
}>;

function compareItems<TPayload>(a: HeapItem<TPayload>, b: HeapItem<TPayload>): number {
    if (a.dueTick !== b.dueTick) {
        return a.dueTick - b.dueTick;
    }
    return a.seq - b.seq;
}

export class TimeWheel<TPayload = unknown> {
    readonly #heap: Array<HeapItem<TPayload>> = [];
    readonly #latestVersionById = new Map<string, number>();
    #nextSeq = 1;

    size(): number {
        return this.#latestVersionById.size;
    }

    schedule(job: ScheduledJob<TPayload>): void {
        if (!job || typeof job !== 'object') {
            throw new Error('TimeWheel.schedule: job is required');
        }
        if (typeof job.id !== 'string' || job.id.trim() === '') {
            throw new Error('TimeWheel.schedule: job.id is required');
        }
        if (!Number.isInteger(job.dueTick) || job.dueTick < 0) {
            throw new Error('TimeWheel.schedule: job.dueTick must be a non-negative integer');
        }

        const id = job.id.trim();
        const nextVersion = (this.#latestVersionById.get(id) ?? 0) + 1;
        this.#latestVersionById.set(id, nextVersion);
        this.#push({
            id,
            dueTick: job.dueTick,
            payload: job.payload,
            version: nextVersion,
            seq: this.#nextSeq++,
        });
    }

    cancel(id: string): boolean {
        if (typeof id !== 'string' || id.trim() === '') {
            return false;
        }
        const trimmed = id.trim();
        const existed = this.#latestVersionById.delete(trimmed);
        return existed;
    }

    peekNextDueTick(): number | null {
        this.#gcTop();
        const top = this.#heap[0];
        return top ? top.dueTick : null;
    }

    drainDue(nowTick: number, opts?: { maxJobs?: number }): ScheduledJob<TPayload>[] {
        if (!Number.isInteger(nowTick) || nowTick < 0) {
            throw new Error('TimeWheel.drainDue: nowTick must be a non-negative integer');
        }
        const maxJobsRaw = opts?.maxJobs ?? Number.POSITIVE_INFINITY;
        const maxJobs = Number.isFinite(maxJobsRaw) ? Math.max(0, Math.floor(maxJobsRaw)) : Number.POSITIVE_INFINITY;
        if (maxJobs === 0) {
            return [];
        }

        const out: ScheduledJob<TPayload>[] = [];
        while (out.length < maxJobs) {
            this.#gcTop();
            const top = this.#heap[0];
            if (!top || top.dueTick > nowTick) {
                break;
            }
            const popped = this.#pop();
            if (!popped) {
                break;
            }

            const latestVersion = this.#latestVersionById.get(popped.id);
            if (latestVersion === undefined || latestVersion !== popped.version) {
                continue;
            }
            this.#latestVersionById.delete(popped.id);
            out.push({ id: popped.id, dueTick: popped.dueTick, payload: popped.payload });
        }
        return out;
    }

    #isStale(item: HeapItem<TPayload>): boolean {
        const latest = this.#latestVersionById.get(item.id);
        return latest === undefined || latest !== item.version;
    }

    #gcTop(): void {
        while (this.#heap.length > 0) {
            const top = this.#heap[0]!;
            if (!this.#isStale(top)) {
                return;
            }
            this.#pop();
        }
    }

    #push(item: HeapItem<TPayload>): void {
        this.#heap.push(item);
        this.#siftUp(this.#heap.length - 1);
    }

    #pop(): HeapItem<TPayload> | null {
        const n = this.#heap.length;
        if (n === 0) {
            return null;
        }
        const top = this.#heap[0]!;
        const last = this.#heap.pop()!;
        if (n > 1) {
            this.#heap[0] = last;
            this.#siftDown(0);
        }
        return top;
    }

    #siftUp(index: number): void {
        let i = index;
        while (i > 0) {
            const parent = Math.floor((i - 1) / 2);
            if (compareItems(this.#heap[i]!, this.#heap[parent]!) >= 0) {
                break;
            }
            const tmp = this.#heap[i]!;
            this.#heap[i] = this.#heap[parent]!;
            this.#heap[parent] = tmp;
            i = parent;
        }
    }

    #siftDown(index: number): void {
        let i = index;
        const n = this.#heap.length;
        while (true) {
            const left = i * 2 + 1;
            const right = left + 1;
            let smallest = i;
            if (left < n && compareItems(this.#heap[left]!, this.#heap[smallest]!) < 0) {
                smallest = left;
            }
            if (right < n && compareItems(this.#heap[right]!, this.#heap[smallest]!) < 0) {
                smallest = right;
            }
            if (smallest === i) {
                break;
            }
            const tmp = this.#heap[i]!;
            this.#heap[i] = this.#heap[smallest]!;
            this.#heap[smallest] = tmp;
            i = smallest;
        }
    }
}

