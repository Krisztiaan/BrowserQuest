import {
    TypedEventEmitter,
    type EventCallback,
    type NoEvents,
    type TypedEventMap,
    type Unsubscribe,
} from './typed-event-emitter';

export class Evented<TEvents extends TypedEventMap = NoEvents> {
    readonly #events = new TypedEventEmitter<TEvents>();

    on<TEventName extends keyof TEvents>(
        eventName: TEventName,
        callback: EventCallback<TEvents[TEventName]>
    ): Unsubscribe {
        return this.#events.on(eventName, callback);
    }

    once<TEventName extends keyof TEvents>(
        eventName: TEventName,
        callback: EventCallback<TEvents[TEventName]>
    ): Unsubscribe {
        return this.#events.once(eventName, callback);
    }

    off<TEventName extends keyof TEvents>(eventName: TEventName, callback: EventCallback<TEvents[TEventName]>): void {
        this.#events.off(eventName, callback);
    }

    emit<TEventName extends keyof TEvents>(eventName: TEventName, ...args: TEvents[TEventName]): void {
        this.#events.emit(eventName, ...args);
    }
}
