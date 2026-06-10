import { EcsWorld } from './world';
import { Queue } from './queues';
import { WorldResources } from './resources';

export class WorldState<TCommand = never, TEvent = never> {
    readonly world = new EcsWorld();
    readonly resources = new WorldResources();
    readonly commands = new Queue<TCommand>();
    readonly events = new Queue<TEvent>();
}
