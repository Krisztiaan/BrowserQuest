import type { WorldState } from './world-state';

export type SchedulerStage = 'pre' | 'sim' | 'post';

export type SystemContext = Readonly<{
    tick: number;
}>;

export type System<TCommand = never, TEvent = never> = (state: WorldState<TCommand, TEvent>, ctx: SystemContext) => void;

export type SchedulerHooks = Partial<{
    onSystemStart(stage: SchedulerStage, name: string): void;
    onSystemEnd(stage: SchedulerStage, name: string, elapsedMs: number): void;
    onSystemBudgetExceeded(stage: SchedulerStage, name: string, budgetMs: number, elapsedMs: number): void;
}>;

type RegisteredSystem<TCommand, TEvent> = Readonly<{
    name: string;
    run: System<TCommand, TEvent>;
    budgetMs?: number;
}>;

export class Scheduler<TCommand = never, TEvent = never> {
    #systems: Record<SchedulerStage, Array<RegisteredSystem<TCommand, TEvent>>> = {
        pre: [],
        sim: [],
        post: [],
    };
    #hooks: SchedulerHooks;
    #nowMs: () => number;

    constructor({
        hooks = {},
        nowMs = () => Date.now(),
    }: {
        hooks?: SchedulerHooks;
        nowMs?: () => number;
    } = {}) {
        this.#hooks = hooks;
        this.#nowMs = nowMs;
    }

    register(stage: SchedulerStage, name: string, run: System<TCommand, TEvent>): void {
        this.registerWithOptions(stage, name, run, undefined);
    }

    registerWithOptions(
        stage: SchedulerStage,
        name: string,
        run: System<TCommand, TEvent>,
        options?: { budgetMs?: number }
    ): void {
        if (!name) {
            throw new Error('Scheduler.register: system name is required');
        }
        const budgetMs = options?.budgetMs;
        this.#systems[stage].push({ name, run, budgetMs });
    }

    tick(state: WorldState<TCommand, TEvent>, tick: number): void {
        const ctx: SystemContext = Object.freeze({ tick });
        this.#runStage('pre', state, ctx);
        this.#runStage('sim', state, ctx);
        this.#runStage('post', state, ctx);
    }

    #runStage(stage: SchedulerStage, state: WorldState<TCommand, TEvent>, ctx: SystemContext): void {
        const systems = this.#systems[stage];
        for (let i = 0; i < systems.length; i += 1) {
            const sys = systems[i];
            if (!sys) {
                continue;
            }
            this.#hooks.onSystemStart?.(stage, sys.name);
            const startedAt = this.#nowMs();
            sys.run(state, ctx);
            const elapsedMs = this.#nowMs() - startedAt;
            this.#hooks.onSystemEnd?.(stage, sys.name, elapsedMs);
            const budgetMs = sys.budgetMs;
            if (typeof budgetMs === 'number' && elapsedMs > budgetMs) {
                this.#hooks.onSystemBudgetExceeded?.(stage, sys.name, budgetMs, elapsedMs);
            }
        }
    }
}
