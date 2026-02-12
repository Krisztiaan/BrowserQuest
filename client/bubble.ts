import Timer from './timer';

class Bubble {
    id: string;
    element: HTMLDivElement;
    timer: Timer;

    constructor(id: string, element: HTMLDivElement, time: number) {
        this.id = id;
        this.element = element;
        this.timer = new Timer(5000, time);
    }

    isOver(time: number): boolean {
        if (this.timer.isOver(time)) {
            return true;
        }
        return false;
    }

    destroy(): void {
        this.element.parentNode?.removeChild(this.element);
    }

    reset(time: number): void {
        this.timer.lastTime = time;
    }
}

class BubbleManager {
    container: Element | null;
    bubbles: Record<string, Bubble>;

    constructor(container: string | Element | null) {
        if (typeof container === 'string') {
            this.container = document.querySelector(container);
        } else {
            this.container = container;
        }
        this.bubbles = {};
    }

    getBubbleById(id: string): Bubble | null {
        if (id in this.bubbles) {
            return this.bubbles[id];
        }
        return null;
    }

    create(id: string, message: string, time: number): void {
        if (this.bubbles[id]) {
            const bubble = this.bubbles[id];
            const bubbleText = bubble.element.querySelector('p');
            bubble.reset(time);
            if (bubbleText) {
                bubbleText.innerHTML = message;
            }
        } else {
            const el = document.createElement('div');
            el.id = id;
            el.className = 'bubble';

            const text = document.createElement('p');
            text.innerHTML = message;
            el.appendChild(text);

            const thingy = document.createElement('div');
            thingy.className = 'thingy';
            el.appendChild(thingy);

            if (this.container) {
                this.container.appendChild(el);
            }

            this.bubbles[id] = new Bubble(id, el, time);
        }
    }

    update(time: number): void {
        const bubblesToDelete: string[] = [];

        Object.keys(this.bubbles).forEach((id) => {
            const bubble = this.bubbles[id];
            if (bubble.isOver(time)) {
                bubble.destroy();
                bubblesToDelete.push(bubble.id);
            }
        });

        bubblesToDelete.forEach((id) => {
            delete this.bubbles[id];
        });
    }

    clean(): void {
        const bubblesToDelete: string[] = [];

        Object.keys(this.bubbles).forEach((id) => {
            const bubble = this.bubbles[id];
            bubble.destroy();
            bubblesToDelete.push(bubble.id);
        });

        bubblesToDelete.forEach((id) => {
            delete this.bubbles[id];
        });

        this.bubbles = {};
    }

    destroyBubble(id: string): void {
        const bubble = this.getBubbleById(id);

        if (bubble) {
            bubble.destroy();
            delete this.bubbles[id];
        }
    }

    forEachBubble(callback: (bubble: Bubble) => void): void {
        Object.keys(this.bubbles).forEach((id) => {
            callback(this.bubbles[id]);
        }, this);
    }
}

export default BubbleManager;
