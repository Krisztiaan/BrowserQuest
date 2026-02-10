export type TypedEventMap = Record<string, unknown[]>;
export type NoEvents = Record<never, never>;
export type MergeEvents<TLeft extends TypedEventMap, TRight extends TypedEventMap> = TLeft & TRight;
export type Unsubscribe = () => void;

export type EventCallback<TArgs extends unknown[]> = (...args: TArgs) => void;

export interface TypedEventSource<TEvents extends TypedEventMap> {
    on<TEventName extends keyof TEvents>(eventName: TEventName, callback: EventCallback<TEvents[TEventName]>): Unsubscribe;
}

export interface TypedEventBus<TEvents extends TypedEventMap> {
    on<TEventName extends keyof TEvents>(eventName: TEventName, callback: EventCallback<TEvents[TEventName]>): Unsubscribe;
    once<TEventName extends keyof TEvents>(
        eventName: TEventName,
        callback: EventCallback<TEvents[TEventName]>
    ): Unsubscribe;
    off<TEventName extends keyof TEvents>(eventName: TEventName, callback: EventCallback<TEvents[TEventName]>): void;
    emit<TEventName extends keyof TEvents>(eventName: TEventName, ...args: TEvents[TEventName]): void;
}

export class TypedEventEmitter<TEvents extends TypedEventMap> implements TypedEventBus<TEvents> {
    private listeners = new Map<keyof TEvents, Set<EventCallback<TEvents[keyof TEvents]>>>();

    on<TEventName extends keyof TEvents>(eventName: TEventName, callback: EventCallback<TEvents[TEventName]>): Unsubscribe {
        let callbacks = this.listeners.get(eventName);
        if (!callbacks) {
            callbacks = new Set<EventCallback<TEvents[TEventName]>>() as Set<EventCallback<TEvents[keyof TEvents]>>;
            this.listeners.set(eventName, callbacks);
        }

        callbacks.add(callback as EventCallback<TEvents[keyof TEvents]>);

        return () => {
            this.off(eventName, callback);
        };
    }

    once<TEventName extends keyof TEvents>(
        eventName: TEventName,
        callback: EventCallback<TEvents[TEventName]>
    ): Unsubscribe {
        let unsubscribe: Unsubscribe = () => {};
        const onceCallback = ((...args: TEvents[TEventName]) => {
            unsubscribe();
            callback(...args);
        }) as EventCallback<TEvents[TEventName]>;

        unsubscribe = this.on(eventName, onceCallback);
        return unsubscribe;
    }

    off<TEventName extends keyof TEvents>(eventName: TEventName, callback: EventCallback<TEvents[TEventName]>): void {
        const callbacks = this.listeners.get(eventName);
        if (!callbacks) {
            return;
        }

        callbacks.delete(callback as EventCallback<TEvents[keyof TEvents]>);
        if (callbacks.size === 0) {
            this.listeners.delete(eventName);
        }
    }

    emit<TEventName extends keyof TEvents>(eventName: TEventName, ...args: TEvents[TEventName]): void {
        const callbacks = this.listeners.get(eventName);
        if (!callbacks || callbacks.size === 0) {
            return;
        }

        // Copy listeners so emit behavior remains stable during mutations.
        const snapshot = Array.from(callbacks) as Array<EventCallback<TEvents[TEventName]>>;
        for (const callback of snapshot) {
            callback(...args);
        }
    }
}
