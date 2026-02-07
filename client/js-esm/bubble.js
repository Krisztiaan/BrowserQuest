import Timer from 'timer';
import Class from 'compat/class';

var Bubble = Class.extend({
    init: function(id, element, time) {
        this.id = id;
        this.element = element;
        this.timer = new Timer(5000, time);
    },

    isOver: function(time) {
        if(this.timer.isOver(time)) {
            return true;
        }
        return false;
    },

    destroy: function() {
        if(this.element && this.element.parentNode) {
            this.element.parentNode.removeChild(this.element);
        }
    },

    reset: function(time) {
        this.timer.lastTime = time;
    }
});

var BubbleManager = Class.extend({
    init: function(container) {
        if(typeof container === 'string') {
            this.container = document.querySelector(container);
        } else {
            this.container = container;
        }
        this.bubbles = {};
    },

    getBubbleById: function(id) {
        if(id in this.bubbles) {
            return this.bubbles[id];
        }
        return null;
    },

    create: function(id, message, time) {
        if(this.bubbles[id]) {
            var bubble = this.bubbles[id];
            var bubbleText = bubble.element ? bubble.element.querySelector('p') : null;
            bubble.reset(time);
            if(bubbleText) {
                bubbleText.innerHTML = message;
            }
        }
        else {
            var el = document.createElement('div');
            el.id = id;
            el.className = 'bubble';

            var text = document.createElement('p');
            text.innerHTML = message;
            el.appendChild(text);

            var thingy = document.createElement('div');
            thingy.className = 'thingy';
            el.appendChild(thingy);

            if(this.container) {
                this.container.appendChild(el);
            }

            this.bubbles[id] = new Bubble(id, el, time);
        }
    },

    update: function(time) {
        var self = this,
            bubblesToDelete = [];
    
        Object.keys(this.bubbles).forEach(function(id) {
            var bubble = self.bubbles[id];
            if(bubble.isOver(time)) {
                bubble.destroy();
                bubblesToDelete.push(bubble.id);
            }
        });
    
        bubblesToDelete.forEach(function(id) {
            delete self.bubbles[id];
        });
    },

    clean: function() {
        var self = this,
            bubblesToDelete = [];
    
        Object.keys(this.bubbles).forEach(function(id) {
            var bubble = self.bubbles[id];
            bubble.destroy();
            bubblesToDelete.push(bubble.id);
        });
    
        bubblesToDelete.forEach(function(id) {
            delete self.bubbles[id];
        });
    
        this.bubbles = {};
    },

    destroyBubble: function(id) {
        var bubble = this.getBubbleById(id);
    
        if(bubble) {
            bubble.destroy();
            delete this.bubbles[id];
        }
    },
    
    forEachBubble: function(callback) {
        Object.keys(this.bubbles).forEach(function(id) {
            callback(this.bubbles[id]);
        }, this);
    }
});

export default BubbleManager;
