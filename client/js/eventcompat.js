define([], function() {
    var bindEvent = function($target, eventName, handler) {
        if($target && typeof $target.on === 'function') {
            $target.on(eventName, handler);
        } else if($target && typeof $target.bind === 'function') {
            $target.bind(eventName, handler);
        }
    };

    var unbindEvent = function($target, eventName, handler) {
        if($target && typeof $target.off === 'function') {
            $target.off(eventName, handler);
        } else if($target && typeof $target.unbind === 'function') {
            $target.unbind(eventName, handler);
        }
    };

    return {
        bind: bindEvent,
        unbind: unbindEvent
    };
});
