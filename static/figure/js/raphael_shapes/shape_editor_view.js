

var ShapeEditorView = Backbone.View.extend({

        el: $("#body"),


        initialize: function() {

            var self = this;

            // we automatically 'sort' on fetch, add etc.
            // this.model.bind("sync remove sort", this.render, this);

            // Now set up Raphael paper...
            this.paper = Raphael("shapeCanvas", 512, 512);
        },

        events: {
            "mousedown .new_shape_layer": "mousedown",
            "mousemove .new_shape_layer": "mousemove",
            "mouseup .new_shape_layer": "mouseup"
        },


        mousedown: function(event) {
            // Create a new Rect, and start resizing it...
            this.dragging = true;
            var os = $(event.target).offset();
            var dx = event.clientX - os.left;
            var dy = event.clientY - os.top;
            this.clientX_start = dx;
            this.clientY_start = dy;
            console.log("mousedown", dx, dy);

            this.cropModel = new Backbone.Model({
                'x':dx, 'y': dy, 'width': 0, 'height': 0,
                'selected': false});
            this.rect = new RectView({'model':this.cropModel, 'paper': this.paper});
            this.cropModel.set('selected', true);
            return false;
        },

        mouseup: function(event) {
            if (this.dragging) {
                this.dragging = false;
                var json = this.cropModel.toJSON();
                console.log("ADDING...", json);
                this.model.add(json);
                return false;
            }
        },

        mousemove: function(event) {
            if (this.dragging) {
                var dx = event.clientX - this.clientX_start,
                    dy = event.clientY - this.clientY_start;
                if (event.shiftKey) {
                    // make region square!
                    if (Math.abs(dx) > Math.abs(dy)) {
                        if (dy > 0) dy = Math.abs(dx);
                        else dy = -1 * Math.abs(dx);
                    } else {
                        if (dx > 0) dx = Math.abs(dy);
                        else dx = -1 * Math.abs(dy);
                    }
                }
                var negX = Math.min(0, dx),
                    negY = Math.min(0, dy);
                this.cropModel.set({'x': this.clientX_start + negX,
                    'y': this.clientY_start + negY,
                    'width': Math.abs(dx), 'height': Math.abs(dy)});
                return false;
            }
        }
    });
