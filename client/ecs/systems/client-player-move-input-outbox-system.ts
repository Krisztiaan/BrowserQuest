import type { EntityId } from '../../../shared/domain/ids';
import type { ClientWorldKernel } from '../world-kernel';
import { resolveClientMovementNetcodeConfig } from '../../movement-netcode-config';

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

    // Owned mode streams move.pos instead; sending move.input as well would make
    // the server integrate movement on its own and fight the streamed positions.
    const config = resolveClientMovementNetcodeConfig();
    if (config.rollout.clientOwnedMovement && host.kernel.clientMovePosIntentSupported) {
        return;
    }

    host.kernel.enqueueClientCommand({ type: 'clientSendMoveInput', keysMask });
}
