import type { Command } from './commands';
import type { DomainEvent } from './events';
import type { System } from './scheduler';
import { OUTBOX_RESOURCE } from './outbox';
import { mapDomainEventToProtocolAction } from './command-systems';

export const flushDomainEventsToOutboxSystem: System<Command, DomainEvent> = (state) => {
    const outbox = state.resources.require(OUTBOX_RESOURCE);
    const events = state.events.drain();
    for (let i = 0; i < events.length; i += 1) {
        const event = events[i];
        if (!event) {
            continue;
        }
        const messages = mapDomainEventToProtocolAction(event);
        for (let j = 0; j < messages.length; j += 1) {
            const msg = messages[j];
            if (msg) {
                outbox.push(msg);
            }
        }
    }
};
