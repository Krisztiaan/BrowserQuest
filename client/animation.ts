class Animation {
    name: string;
    length: number;
    row: number;
    width: number;
    height: number;
    speed: number;
    lastTime: number;
    count: number;
    onEndCount: () => void;
    currentFrame: { index: number; x: number; y: number };

    constructor(name: string, length: number, row: number, width: number, height: number) {
        this.name = name;
        this.length = length;
        this.row = row;
        this.width = width;
        this.height = height;
        this.speed = 100;
        this.lastTime = 0;
        this.count = 0;
        this.onEndCount = function () {};
        this.currentFrame = { index: 0, x: 0, y: 0 };
        this.reset();
    }

    tick(): void {
        let i = this.currentFrame.index;

        i = i < this.length - 1 ? i + 1 : 0;

        if (this.count > 0) {
            if (i === 0) {
                this.count -= 1;
                if (this.count === 0) {
                    this.currentFrame.index = 0;
                    this.onEndCount();
                    return;
                }
            }
        }

        this.currentFrame.x = this.width * i;
        this.currentFrame.y = this.height * this.row;
        this.currentFrame.index = i;
    }

    setSpeed(speed?: number): void {
        if (speed !== undefined) {
            this.speed = speed;
        }
    }

    setCount(count: number, onEndCount: () => void): void {
        this.count = count;
        this.onEndCount = onEndCount;
    }

    isTimeToAnimate(time: number): boolean {
        return time - this.lastTime > this.speed;
    }

    update(time: number): boolean {
        if (this.lastTime === 0 && this.name.substr(0, 3) === 'atk') {
            this.lastTime = time;
        }

        if (this.isTimeToAnimate(time)) {
            this.lastTime = time;
            this.tick();
            return true;
        }
        return false;
    }

    reset(): void {
        this.lastTime = 0;
        this.currentFrame = { index: 0, x: 0, y: this.row * this.height };
    }
}

export default Animation;
