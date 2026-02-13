export type PixelArtCanvasContext = CanvasRenderingContext2D & {
    mozImageSmoothingEnabled?: boolean;
    webkitImageSmoothingEnabled?: boolean;
    msImageSmoothingEnabled?: boolean;
};

export function disableCanvasImageSmoothing(context: PixelArtCanvasContext): void {
    context.imageSmoothingEnabled = false;
    if (typeof context.mozImageSmoothingEnabled === 'boolean') {
        context.mozImageSmoothingEnabled = false;
    }
    if (typeof context.webkitImageSmoothingEnabled === 'boolean') {
        context.webkitImageSmoothingEnabled = false;
    }
    if (typeof context.msImageSmoothingEnabled === 'boolean') {
        context.msImageSmoothingEnabled = false;
    }
}
