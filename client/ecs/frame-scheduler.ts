export type ClientFrameStage = 'pre_update' | 'update' | 'post_update' | 'render';

export type ClientFrameSystem<THost> = (host: THost) => void;

const STAGE_ORDER: ClientFrameStage[] = ['pre_update', 'update', 'post_update', 'render'];

export class ClientFrameScheduler<THost> {
    readonly stages: Record<ClientFrameStage, Array<ClientFrameSystem<THost>>> = {
        pre_update: [],
        update: [],
        post_update: [],
        render: [],
    };

    add(stage: ClientFrameStage, system: ClientFrameSystem<THost>): void {
        this.stages[stage].push(system);
    }

    runFrame(host: THost): void {
        for (const stage of STAGE_ORDER) {
            const systems = this.stages[stage];
            for (let i = 0; i < systems.length; i += 1) {
                const system = systems[i];
                if (system) {
                    system(host);
                }
            }
        }
    }
}

