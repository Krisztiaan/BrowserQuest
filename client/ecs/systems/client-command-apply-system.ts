import Item from '../../item';
import type { EntityId } from '../../../shared/domain/ids';
import type { ClientCommand } from '../client-commands';
import type { ClientWorldKernel } from '../world-kernel';

export type ClientCommandApplySystemHost = Readonly<{
    kernel: ClientWorldKernel;
    stopPlayerCombat(): void;
    makePlayerGoTo(x: number, y: number): void;
    makePlayerGoToItem(item: Item | null): void;
    getEntityById(id: EntityId): unknown;
}>;

export function runClientCommandApplySystem(host: ClientCommandApplySystemHost): void {
    const commands: ClientCommand[] = host.kernel.drainClientCommands();
    if (commands.length === 0) {
        return;
    }

    for (const command of commands) {
        switch (command.type) {
            case 'stopPlayerCombat': {
                host.stopPlayerCombat();
                break;
            }
            case 'playerGoTo': {
                host.makePlayerGoTo(command.x, command.y);
                break;
            }
            case 'playerGoToItem': {
                const entity = host.getEntityById(command.itemId);
                host.makePlayerGoToItem(entity instanceof Item ? entity : null);
                break;
            }
        }
    }
}

