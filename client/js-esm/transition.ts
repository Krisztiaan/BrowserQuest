import log from './compat/log';

class Transition {
    startValue: number;
    endValue: number;
    duration: number;
    inProgress: boolean;
    startTime: number;
    count: number;
    updateFunction: ((value: number) => void) | null;
    stopFunction: (() => void) | null;

    constructor() {
        this.startValue = 0;
        this.endValue = 0;
        this.duration = 0;
        this.inProgress = false;
        this.startTime = 0;
        this.count = 0;
        this.updateFunction = null;
        this.stopFunction = null;
    }

    start(
        currentTime: number,
        updateFunction: ((value: number) => void) | null,
        stopFunction: (() => void) | null,
        startValue: number,
        endValue: number,
        duration: number
    ): void {
        this.startTime = currentTime;
        this.updateFunction = updateFunction;
        this.stopFunction = stopFunction;
        this.startValue = startValue;
        this.endValue = endValue;
        this.duration = duration;
        this.inProgress = true;
        this.count = 0;
    }

    step(currentTime: number): void {
        if (this.inProgress) {
            if (this.count > 0) {
                this.count -= 1;
                log.debug(currentTime + ': jumped frame');
            } else {
                var elapsed = currentTime - this.startTime;

                if (elapsed > this.duration) {
                    elapsed = this.duration;
                }

                var diff = this.endValue - this.startValue;
                var i = this.startValue + ((diff / this.duration) * elapsed);

                i = Math.round(i);

                if (elapsed === this.duration || i === this.endValue) {
                    this.stop();
                    if (this.stopFunction) {
                        this.stopFunction();
                    }
                } else if (this.updateFunction) {
                    this.updateFunction(i);
                }
            }
        }
    }

    restart(currentTime: number, startValue: number, endValue: number): void {
        this.start(currentTime, this.updateFunction, this.stopFunction, startValue, endValue, this.duration);
        this.step(currentTime);
    }

    stop(): void {
        this.inProgress = false;
    }
}

export default Transition;
