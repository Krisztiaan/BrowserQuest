import { TypedEventEmitter, type EventCallback, type NoEvents, type TypedEventMap, type Unsubscribe } from './typed-event-emitter';

const eventEmitterByInstance = new WeakMap<object, TypedEventEmitter<TypedEventMap>>();

function getEventEmitter<TEvents extends TypedEventMap>(instance: object): TypedEventEmitter<TEvents> {
    let emitter = eventEmitterByInstance.get(instance);
    if (!emitter) {
        emitter = new TypedEventEmitter<TypedEventMap>();
        eventEmitterByInstance.set(instance, emitter);
    }
    return emitter as unknown as TypedEventEmitter<TEvents>;
}

export class Evented<TEvents extends TypedEventMap = NoEvents> {
    on<TEventName extends keyof TEvents>(eventName: TEventName, callback: EventCallback<TEvents[TEventName]>): Unsubscribe {
        return getEventEmitter<TEvents>(this).on(eventName, callback);
    }

    once<TEventName extends keyof TEvents>(
        eventName: TEventName,
        callback: EventCallback<TEvents[TEventName]>
    ): Unsubscribe {
        return getEventEmitter<TEvents>(this).once(eventName, callback);
    }

    off<TEventName extends keyof TEvents>(eventName: TEventName, callback: EventCallback<TEvents[TEventName]>): void {
        getEventEmitter<TEvents>(this).off(eventName, callback);
    }

    emit<TEventName extends keyof TEvents>(eventName: TEventName, ...args: TEvents[TEventName]): void {
        getEventEmitter<TEvents>(this).emit(eventName, ...args);
    }
}
