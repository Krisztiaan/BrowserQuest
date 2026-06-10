import type { EntityId } from '../../../shared/domain/ids';
import type { ClientWorldKernel } from '../world-kernel';

export type ClientPlayerMoveInputOutboxSystemHost = Readonly<{
    started: boolean;
    kernel: ClientWorldKernel;
    playerId: EntityId | null;
}>;

export function runClientPlayerMoveInputOutboxSystem(host: ClientPlayerMoveInputOutboxSystemHost): void {
    if (!host.started || !host.playerId) {
        return;
    }

    const keysMask = host.kernel.consumeClientMoveInputDirty();
    if (keysMask === null) {
        return;
    }

    host.kernel.enqueueClientCommand({ type: 'clientSendMoveInput', keysMask });
}
