import type { EffectKindId, IntentTypeId, InteractionKindId, ModuleId, OutcomeTypeId } from './kind-ids';

export type IntentHandlerResult = void | Readonly<{ ok: true }> | Readonly<{ ok: false; reason: string }>;
type ModulePayload = string | number | boolean | null | undefined | object;
export type IntentHandler<TContext = object, TPayload extends ModulePayload = ModulePayload> = (
    ctx: TContext,
    payload: TPayload
) => IntentHandlerResult;
export type InteractionHandler<TContext = object, TPayload extends ModulePayload = ModulePayload> = (
    ctx: TContext,
    payload: TPayload
) => void;
export type EffectHandler<TContext = object, TPayload extends ModulePayload = ModulePayload> = (
    ctx: TContext,
    payload: TPayload
) => void;
export type OutcomeHandler<TContext = object, TPayload extends ModulePayload = ModulePayload> = (
    ctx: TContext,
    payload: TPayload
) => void;

export type ModuleManifest = Readonly<{
    id: ModuleId;
    deps?: ReadonlyArray<ModuleId>;
    register(registry: GameModuleRegistry): void;
}>;

function resolveModuleOrder(manifests: ReadonlyArray<ModuleManifest>): ModuleManifest[] {
    const byId = new Map<ModuleId, { index: number; manifest: ModuleManifest }>();
    for (const [index, manifest] of manifests.entries()) {
        const existing = byId.get(manifest.id);
        if (existing) {
            throw new Error(`Duplicate module id: ${manifest.id}`);
        }
        byId.set(manifest.id, { index, manifest });
    }

    const indegree = new Map<ModuleId, number>();
    const outgoing = new Map<ModuleId, ModuleId[]>();
    const addEdge = (from: ModuleId, to: ModuleId) => {
        const list = outgoing.get(from);
        if (list) {
            list.push(to);
        } else {
            outgoing.set(from, [to]);
        }
        indegree.set(to, (indegree.get(to) ?? 0) + 1);
    };

    for (const manifest of manifests) {
        indegree.set(manifest.id, indegree.get(manifest.id) ?? 0);
    }

    for (const manifest of manifests) {
        for (const dep of manifest.deps ?? []) {
            if (!byId.has(dep)) {
                throw new Error(`Unknown module dependency: ${manifest.id} depends on ${dep}`);
            }
            addEdge(dep, manifest.id);
        }
    }

    const ready: Array<{ index: number; manifest: ModuleManifest }> = [];
    for (const manifest of manifests) {
        if ((indegree.get(manifest.id) ?? 0) === 0) {
            const entry = byId.get(manifest.id);
            if (entry) {
                ready.push({ index: entry.index, manifest: entry.manifest });
            }
        }
    }
    ready.sort((a, b) => a.index - b.index);

    const ordered: ModuleManifest[] = [];
    while (ready.length > 0) {
        const next = ready.shift();
        if (!next) {
            break;
        }
        ordered.push(next.manifest);

        const neighbors = outgoing.get(next.manifest.id) ?? [];
        for (const neighbor of neighbors) {
            indegree.set(neighbor, (indegree.get(neighbor) ?? 0) - 1);
            if ((indegree.get(neighbor) ?? 0) === 0) {
                const entry = byId.get(neighbor);
                if (!entry) {
                    continue;
                }
                // Insert while preserving deterministic order based on original input index.
                const insertAt = ready.findIndex((candidate) => candidate.index > entry.index);
                if (insertAt === -1) {
                    ready.push({ index: entry.index, manifest: entry.manifest });
                } else {
                    ready.splice(insertAt, 0, { index: entry.index, manifest: entry.manifest });
                }
            }
        }
    }

    if (ordered.length !== manifests.length) {
        const remaining = manifests
            .map((m) => m.id)
            .filter((id) => (indegree.get(id) ?? 0) > 0)
            .join(', ');
        throw new Error(`Module dependency cycle detected among: ${remaining}`);
    }

    return ordered;
}

export class GameModuleRegistry {
    readonly moduleOrder: ModuleId[] = [];

    readonly intentHandlers = new Map<IntentTypeId, IntentHandler>();
    readonly interactionHandlers = new Map<InteractionKindId, InteractionHandler>();
    readonly effectHandlers = new Map<EffectKindId, EffectHandler>();
    readonly outcomeHandlers = new Map<OutcomeTypeId, OutcomeHandler>();

    registerModules(manifests: ReadonlyArray<ModuleManifest>): void {
        this.moduleOrder.length = 0;

        const ordered = resolveModuleOrder(manifests);
        for (const manifest of ordered) {
            this.moduleOrder.push(manifest.id);
            manifest.register(this);
        }
    }

    registerIntentHandler(id: IntentTypeId, handler: IntentHandler): void {
        if (this.intentHandlers.has(id)) {
            throw new Error(`Duplicate intent handler: ${id}`);
        }
        this.intentHandlers.set(id, handler);
    }

    registerInteractionHandler(id: InteractionKindId, handler: InteractionHandler): void {
        if (this.interactionHandlers.has(id)) {
            throw new Error(`Duplicate interaction handler: ${id}`);
        }
        this.interactionHandlers.set(id, handler);
    }

    registerEffectHandler(id: EffectKindId, handler: EffectHandler): void {
        if (this.effectHandlers.has(id)) {
            throw new Error(`Duplicate effect handler: ${id}`);
        }
        this.effectHandlers.set(id, handler);
    }

    registerOutcomeHandler(id: OutcomeTypeId, handler: OutcomeHandler): void {
        if (this.outcomeHandlers.has(id)) {
            throw new Error(`Duplicate outcome handler: ${id}`);
        }
        this.outcomeHandlers.set(id, handler);
    }

    getIntentHandler(id: IntentTypeId): IntentHandler | undefined {
        return this.intentHandlers.get(id);
    }

    getInteractionHandler(id: InteractionKindId): InteractionHandler | undefined {
        return this.interactionHandlers.get(id);
    }

    getEffectHandler(id: EffectKindId): EffectHandler | undefined {
        return this.effectHandlers.get(id);
    }

    getOutcomeHandler(id: OutcomeTypeId): OutcomeHandler | undefined {
        return this.outcomeHandlers.get(id);
    }
}
