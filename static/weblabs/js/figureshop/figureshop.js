

    // ----------------------- Backbone MODEL --------------------------------------------


    // ------------------------ Panel -----------------------------------------
    // Simple place-holder for each Panel. Will have E.g. imageId, rendering options etc
    // Attributes can be added as we need them.
    var Panel = Backbone.Model.extend({

        defaults: {
            x: 100,     // coordinates on the 'paper'
            y: 100,
            width: 512,
            height: 512,
            selected: false
        },

        initialize: function() {

            this.on('change', function(event){
                console.log("** Panel Model Change", event.changed);
            });
        },

        save_channel: function(cIndex, attr, value) {

            var oldChs = this.get('channels');
            // Need to clone the list of channels...
            var chs = [];
            for (var i=0; i<oldChs.length; i++) {
                chs.push( $.extend(true, {}, oldChs[i]) );
            }
            // ... then set new value ...
            chs[cIndex][attr] = value;
            // ... so that we get the changed event triggering OK
            this.save('channels', chs);
        },

        toggle_channel: function(cIndex, active){

            if (typeof active == "undefined"){
                active = !this.get('channels')[cIndex].active;
            }
            this.save_channel(cIndex, 'active', active);
        },

        // When a multi-select rectangle is drawn around several Panels
        // a resize of the rectangle x1, y1, w1, h1 => x2, y2, w2, h2
        // will resize the Panels within it in proportion.
        // This might be during a drag, or drag-stop (save=true)
        multiselectdrag: function(x1, y1, w1, h1, x2, y2, w2, h2, save){

            var shift_x = function(startX) {
                return ((startX - x1)/w1) * w2 + x2;
            }
            var shift_y = function(startY) {
                return ((startY - y1)/h1) * h2 + y2;
            }

            var newX = shift_x( this.get('x') ),
                newY = shift_y( this.get('y') ),
                newW = shift_x( this.get('x')+this.get('width') ) - newX,
                newH = shift_y( this.get('y')+this.get('height') ) - newY;

            // Either set the new coordinates...
            if (save) {
                this.save( {'x':newX, 'y':newY, 'width':newW, 'height':newH} );
            } else {
                // ... Or update the UI Panels
                // both svg and DOM views listen for this...
                this.trigger('drag_resize', [newX, newY, newW, newH] );
            }
        },

        // Drag resizing - notify the PanelView without saving
        drag_resize: function(x, y, w, h) {
            this.trigger('drag_resize', [x, y, w, h] );
        },

        // Drag moving - notify the PanelView & SvgModel with/without saving
        drag_xy: function(dx, dy, save) {
            // Ignore any drag_stop events from simple clicks (no drag)
            if (dx == 0 && dy == 0) {
                return;
            }
            var newX = this.get('x') + dx,
                newY = this.get('y') + dy,
                w = this.get('width'),
                h = this.get('height');

            // Either set the new coordinates...
            if (save) {
                this.save( {'x':newX, 'y':newY} );
            } else {
                // ... Or update the UI Panels
                // both svg and DOM views listen for this...
                this.trigger('drag_resize', [newX, newY, w, h] );
            }

            // we return new X and Y so FigureModel knows where panels are
            return {'x':newX, 'y':newY}
        },

        get_centre: function() {
            return {'x':this.get('x') + (this.get('width')/2),
                'y':this.get('y') + (this.get('height')/2)}
        }

    });

    // ------------------------ Panel Collection -------------------------
    var PanelList = Backbone.Collection.extend({
        model: Panel,

        getSelected: function() {
            return this.filter(function(panel){
                return panel.get('selected'); 
            });
        },

        localStorage: new Backbone.LocalStorage("figureShop-backbone")
    });


    // ------------------------- Figure Model -----------------------------------
    // Has a PanelList as well as other attributes of the Figure
    var FigureModel = Backbone.Model.extend({

        defaults: {
            'curr_zoom': 100
        },

        initialize: function() {
            this.panels = new PanelList();      //this.get("shapes"));
        },

        align_left: function() {
            var selected = this.getSelected(),
                x_vals = [];
            for (var i=0; i<selected.length; i++) {
                x_vals.push(selected[i].get('x'));
            };
            var min_x = Math.min.apply(window, x_vals);

            for (var i=0; i<selected.length; i++) {
                selected[i].set('x', min_x);
            };
        },

        align_top: function() {
            var selected = this.getSelected(),
                y_vals = [];
            for (var i=0; i<selected.length; i++) {
                y_vals.push(selected[i].get('y'));
            };
            var min_y = Math.min.apply(window, y_vals);

            for (var i=0; i<selected.length; i++) {
                selected[i].set('y', min_y);
            };
        },

        align_grid: function() {
            var sel = this.getSelected(),
                top_left = this.get_top_left_panel(sel),
                top_x = top_left.get('x'),
                top_y = top_left.get('y'),
                grid = [],
                row = [top_left],
                next_panel = top_left;

            // populate the grid, getting neighbouring panel each time
            while (next_panel) {
                c = next_panel.get_centre();
                next_panel = this.get_panel_at(c.x + next_panel.get('width'), c.y, sel);

                // if next_panel is not found, reached end of row. Try start new row...
                if (typeof next_panel == 'undefined') {
                    grid.push(row);
                    // next_panel is below the first of the current row
                    c = row[0].get_centre();
                    next_panel = this.get_panel_at(c.x, c.y + row[0].get('height'), sel);
                    row = [];
                }
                if (next_panel) {
                    row.push(next_panel);
                }
            }

            var spacer = top_left.get('width')/20,
                row,
                new_x = top_x,
                new_y = top_y,
                max_h = 0;
            for (var r=0; r<grid.length; r++) {
                row = grid[r];
                for (var c=0; c<row.length; c++) {
                    panel = row[c];
                    panel.save({'x':new_x, 'y':new_y});
                    max_h = Math.max(max_h, panel.get('height'));
                    new_x = new_x + spacer + panel.get('width');
                }
                new_y = new_y + spacer + max_h;
                new_x = top_x;
            }
        },

        get_panel_at: function(x, y, panels) {
            for(var i=0; i<panels.length; i++) {
                p = panels[i];
                if ((p.get('x') < x && (p.get('x')+p.get('width')) > x)
                        && (p.get('y') < y && (p.get('y')+p.get('height')) > y)) {
                    return p;
                }
            }
        },

        get_top_left_panel: function(panels) {
            // top-left panel is one where x + y is least
            var p, top_left;
            for(var i=0; i<panels.length; i++) {
                p = panels[i];
                if (i == 0) {
                    top_left = p;
                } else {
                    if ((p.get('x') + p.get('y')) < (top_left.get('x') + top_left.get('y'))) {
                        top_left = p;
                    }
                }
            }
            return top_left;
        },

        align_size: function(width, height) {
            var sel = this.getSelected(),
                ref = this.get_top_left_panel(sel),
                ref_width = width ? ref.get('width') : false,
                ref_height = height ? ref.get('height') : false,
                new_w, new_h,
                p;

            for (var i=0; i<sel.length; i++) {
                p = sel[i];
                if (ref_width && ref_height) {
                    new_w = ref_width;
                    new_h = ref_height;
                } else if (ref_width) {
                    new_w = ref_width;
                    new_h = (ref_width/p.get('width')) * p.get('height');
                } else if (ref_height) {
                    new_h = ref_height;
                    new_w = (ref_height/p.get('height')) * p.get('width');
                }
                p.save({'width':new_w, 'height':new_h});
            }
        },

        // This can come from multi-select Rect OR any selected Panel
        // Need to notify ALL panels and Multi-select Rect.
        drag_xy: function(dx, dy, save) {
            if (dx == 0 && dy == 0) return;

            var minX = 10000,
                minY = 10000,
                xy;
            // First we notidy all Panels
            var selected = this.getSelected();
            for (var i=0; i<selected.length; i++) {
                xy = selected[i].drag_xy(dx, dy, save);
                minX = Math.min(minX, xy['x']);
                minY = Math.min(minY, xy['y']);
            };
            // Notify the Multi-select Rect of it's new X and Y
            this.trigger('drag_xy', [minX, minY, save]);
        },


        // This comes from the Multi-Select Rect.
        // Simply delegate to all the Panels
        multiselectdrag: function(x1, y1, w1, h1, x2, y2, w2, h2, save) {
            var selected = this.getSelected();
            for (var i=0; i<selected.length; i++) {
                selected[i].multiselectdrag(x1, y1, w1, h1, x2, y2, w2, h2, save);
            };
        },

        // If already selected, do nothing (unless clearOthers is true)
        setSelected: function(item, clearOthers) {
            if ((!item.get('selected')) || clearOthers) {
                this.clearSelected(false);
                item.set('selected', true);
                this.trigger('change:selection');
            }
        },

        select_all:function() {
            this.panels.each(function(p){
                p.set('selected', true);
            });
            this.trigger('change:selection');
        },

        addSelected: function(item) {
            item.set('selected', true);
            this.trigger('change:selection');
        },

        clearSelected: function(trigger) {
            this.panels.each(function(p){
                p.set('selected', false);
            });
            if (trigger !== false) {
                this.trigger('change:selection');
            }
        },

        getSelected: function() {
            return this.panels.getSelected();
        },

        // Go through all selected and destroy them - trigger selection change
        deleteSelected: function() {
            var selected = this.getSelected();
            for (var i=0; i<selected.length; i++) {
                selected[i].destroy();
            };
            this.trigger('change:selection');
        }

    });


    // -------------------------- Backbone VIEWS -----------------------------------------


    // var SelectionView = Backbone.View.extend({
    var FigureView = Backbone.View.extend({

        el: $("#body"),

        initialize: function(opts) {

            // Delegate some responsibility to other views
            new AlignmentToolbarView({model: this.model});

            // set up various elements and we need repeatedly
            this.$main = $('main');
            this.$canvas = $("#canvas");
            this.$canvas_wrapper = $("#canvas_wrapper");
            this.$paper = $("#paper");

            var self = this;

            // Render on changes to the model
            this.model.on('change:paper_width', this.render, this);

            // If a panel is added...
            this.model.panels.on("add", this.addOne, this);

            // Select a different size paper
            $("#paper_size_chooser").change(function(){
                var wh = $(this).val().split(","),
                    w = wh[0],
                    h = wh[1];
                self.model.set({'paper_width':w, 'paper_height':h});
            });

            // respond to zoom changes
            this.listenTo(this.model, 'change:curr_zoom', this.setZoom);

            // refresh current UI
            this.setZoom();
            this.reCentre();

            // 'Auto-render' on init.
            this.render();

        },

        events: {
            "click .add_panel": "addPanel"
        },

        keyboardEvents: {
            'backspace': 'deleteSelectedPanels',
            'command+a': 'select_all'
        },

        select_all: function() {
            this.model.select_all();
            return false;
        },

        deleteSelectedPanels: function(ev) {
            this.model.deleteSelected();
            return false;
        },

        addPanel: function() {
            var self = this;
            var imgId = prompt("Please enter Image ID:");

            if (parseInt(imgId) > 0) {
                var c = this.getCentre(),
                    w = 512,
                    h = 512,
                    x = c.x - (w/2),
                    y = c.y - (h/2);
                // Get the json data for the image...
                $.getJSON('/webgateway/imgData/' + imgId + '/', function(data){
                    // manipulate it a bit, add x & y etc...
                    data.imageId = data.id;
                    data.name = data.meta.imageName;
                    data.id = undefined;
                    data.width = data.size.width;
                    data.height = data.size.height;
                    data.sizeZ = data.size.z
                    data.sizeT = data.size.t
                    data.orig_width = data.width;
                    data.orig_height = data.height;
                    data.x = x;
                    data.y = y;
                    // create Panel
                    self.model.panels.create(data);
                });
            }
        },

        // User has zoomed the UI - work out new sizes etc...
        // We zoom the main content 'canvas' using css transform: scale()
        // But also need to resize the canvas_wrapper manually.
        setZoom: function() {
            var curr_zoom = this.model.get('curr_zoom'),
                zoom = curr_zoom * 0.01,
                newWidth = parseInt(this.orig_width * zoom),
                newHeight = parseInt(this.orig_height * zoom),
                scale = "scale("+zoom+", "+zoom+")";

            // We want to stay centered on the same spot...
            var curr_centre = this.getCentre(true);

            // Scale canvas via css
            this.$canvas.css({"transform": scale, "-webkit-transform": scale});

            // Scale canvas wrapper manually
            var canvas_w = this.model.get('canvas_width'),
                canvas_h = this.model.get('canvas_height');
            var scaled_w = canvas_w * zoom,
                scaled_h = canvas_h * zoom;
            this.$canvas_wrapper.css({'width':scaled_w+"px", 'height': scaled_h+"px"});
            // and offset the canvas to stay visible
            var margin_top = (canvas_h - scaled_h)/2,
                margin_left = (canvas_w - scaled_w)/2;
            this.$canvas.css({'top': "-"+margin_top+"px", "left": "-"+margin_left+"px"});

            // ...apply centre from before zooming
            if (curr_centre) {
                this.setCentre(curr_centre);
            }

            // Show zoom level in UI
            $("#zoom_input").val(curr_zoom);
        },

        // Centre the viewport on the middle of the paper
        reCentre: function() {
            var paper_w = this.model.get('paper_width'),
                paper_h = this.model.get('paper_height');
            this.setCentre( {'x':paper_w/2, 'y':paper_h/2} );
        },

        // Get the coordinates on the paper of the viewport center.
        // Used after zoom update (but BEFORE the UI has changed)
        getCentre: function(previous) {
            // Need to know the zoom BEFORE the update
            var m = this.model,
                curr_zoom = m.get('curr_zoom');
            if (previous) {
                curr_zoom = m.previous('curr_zoom');
            }
            if (curr_zoom == undefined) {
                return;
            }
            var viewport_w = this.$main.width(),
                viewport_h = this.$main.height(),
                co = this.$canvas_wrapper.offset(),
                mo = this.$main.offset(),
                offst_left = co.left - mo.left,
                offst_top = co.top - mo.top,
                cx = -offst_left + viewport_w/2,
                cy = -offst_top + viewport_h/2,
                zm_fraction = curr_zoom * 0.01;

            var paper_left = (m.get('canvas_width') - m.get('paper_width'))/2,
                paper_top = (m.get('canvas_height') - m.get('paper_height'))/2;
            return {'x':(cx/zm_fraction)-paper_left, 'y':(cy/zm_fraction)-paper_top};
        },

        // Scroll viewport to place a specified paper coordinate at the centre
        setCentre: function(cx_cy, speed) {
            var m = this.model,
                paper_left = (m.get('canvas_width') - m.get('paper_width'))/2,
                paper_top = (m.get('canvas_height') - m.get('paper_height'))/2;
            var curr_zoom = m.get('curr_zoom'),
                zm_fraction = curr_zoom * 0.01,
                cx = (cx_cy.x+paper_left) * zm_fraction,
                cy = (cx_cy.y+paper_top) * zm_fraction,
                viewport_w = this.$main.width(),
                viewport_h = this.$main.height(),
                offst_left = cx - viewport_w/2,
                offst_top = cy - viewport_h/2,
                speed = speed || 0;
            this.$main.animate({
                scrollLeft: offst_left,
                scrollTop: offst_top
            }, speed);
        },

        // Add a panel to the view
        addOne: function(panel) {
            var view = new PanelView({model:panel});    // uiState:this.uiState
            this.$paper.append(view.render().el);
        },

        // Render is called on init()
        // Update any changes to sizes of paper or canvas
        render: function() {
            var m = this.model,
                zoom = m.get('curr_zoom') * 0.01;

            var paper_w = m.get('paper_width'),
                paper_h = m.get('paper_height'),
                canvas_w = m.get('canvas_width'),
                canvas_h = m.get('canvas_height'),
                paper_left = (canvas_w - paper_w)/2,
                paper_top = (canvas_h - paper_h)/2;

            this.$paper.css({'width': paper_w, 'height': paper_h,
                    'left': paper_left, 'top': paper_top});
            $("#canvas").css({'width': this.model.get('canvas_width'),
                    'height': this.model.get('canvas_height')});

            return this;
        }
    });


    var AlignmentToolbarView = Backbone.View.extend({

        el: $("#alignment-toolbar"),

        model:FigureModel,

        events: {
            "click .aleft": "align_left",
            "click .agrid": "align_grid",
            "click .atop": "align_top",

            "click .awidth": "align_width",
            "click .aheight": "align_height",
            "click .asize": "align_size",
        },

        initialize: function() {
            this.listenTo(this.model, 'change:selection', this.render);
            this.$buttons = $("button", this.$el);
        },

        align_left: function() {
            this.model.align_left();
        },

        align_grid: function() {
            this.model.align_grid();
        },

        align_width: function() {
            this.model.align_size(true, false);
        },
        align_height: function() {
            this.model.align_size(false, true);
        },
        align_size: function() {
            this.model.align_size(true, true);
        },

        align_top: function() {
            this.model.align_top();
        },

        render: function() {
            if (this.model.getSelected().length > 1) {
                this.$buttons.removeAttr("disabled");
            } else {
                this.$buttons.attr("disabled", "disabled");
            }
        }
    });



    // -------------------------Panel View -----------------------------------
    // A Panel is a <div>, added to the #paper by the FigureView below.
    var PanelView = Backbone.View.extend({
        tagName: "div",
        template: _.template($('#figure_panel_template').html()),

        initialize: function(opts) {
            // we render on Changes in the model OR selected shape etc.
            this.model.on('destroy', this.remove, this);
            this.listenTo(this.model, 'change:x change:y change:width change:height', this.render_layout);
            this.listenTo(this.model, 'change:channels', this.render_image);
            // This could be handled by backbone.relational, but do it manually for now...
            // this.listenTo(this.model.channels, 'change', this.render);
            // During drag, model isn't updated, but we trigger 'drag'
            this.model.on('drag_resize', this.drag_resize, this);

            this.render();
        },

        events: {
            // "click .img_panel": "select_panel"
        },

        // During drag, we resize etc
        drag_resize: function(xywh) {
            var x = xywh[0],
                y = xywh[1],
                w = xywh[2],
                h = xywh[3];
            this.update_resize(x, y, w, h);
        },

        render_layout: function() {
            var x = this.model.get('x'),
                y = this.model.get('y'),
                w = this.model.get('width'),
                h = this.model.get('height');

            this.update_resize(x, y, w, h);
        },

        update_resize: function(x, y, w, h) {

            this.$el.css({'top': y +'px',
                        'left': x +'px',
                        'width': w +'px',
                        'height': h +'px'});

            // viewport x, y, w, h etc - Must maintain original width/height ratio
            var vp_x = this.model.get('vp_x'),
                vp_y = this.model.get('vp_y'),
                orig_w = this.model.get('orig_width'),
                orig_h = this.model.get('orig_height');
            if (typeof vp_x == 'undefined') {
                var vp_x = 0,
                    vp_y = 0,
                    vp_w = w,
                    vp_h = h,
                    vp_ratio = w / h,
                    orig_ratio = orig_w / orig_h;
                if (Math.abs(orig_ratio - vp_ratio) < 0.01) {
                    // ignore...
                // if viewport is wider than orig, offset y
                } else if (orig_ratio < vp_ratio) {
                    vp_h = vp_w / orig_ratio;
                    vp_y = (vp_h - h)/2;
                } else {
                    vp_w = vp_h * orig_ratio;
                    vp_x = (vp_w - w)/2;
                }
            }

            this.$img_panel.css({'left':-vp_x, 'top':-vp_y, 'width':vp_w, 'height':vp_h})
        },

        render_image: function() {
            var cStrings = [];
            _.each(this.model.get('channels'), function(c, i){
                if (c.active) {
                    cStrings.push(1+i + "|" + c.window.start + ":" + c.window.end + "$" + c.color)
                }
            });
            var renderString = cStrings.join(","),
                imageId = this.model.get('imageId');

            this.$img_panel.attr('src', '/webgateway/render_image/' + imageId + '/?c=' + renderString);
        },

        render: function() {

            // Have to handle potential nulls, since the template doesn't like them!
            var json = {'imageId': this.model.get('imageId')};
            // need to add the render string, E.g: 1|110:398$00FF00,2|...

            var html = this.template(json);
            this.$el.html(html);

            this.$img_panel = $(".img_panel", this.$el);    // cache for later

            this.render_image();
            this.render_layout();

            return this;
        }
    });


    // The 'Right Panel' is the floating Info, Preview etc display.
    // It listens to selection changes on the FigureModel and updates it's display
    // By creating new Sub-Views

    var RightPanelView = Backbone.View.extend({

        initialize: function(opts) {
            // we render on selection Changes in the model
            this.listenTo(this.model, 'change:selection', this.render);

            // this.render();
        },

        render: function() {
            var selected = this.model.getSelected();

            if (this.ipv) {
                this.ipv.remove();
            }
            if (selected.length == 1) {
                this.ipv = new InfoPanelView({model: selected[0]}).render();
                $("#infoTab").append(this.ipv.render().el)
            }

            if (this.ctv) {
                this.ctv.remove();
            }
            if (selected.length == 1) {
                this.ctv = new ChannelToggleView({model: selected[0]});
                $("#channelToggle").empty().append(this.ctv.render().el)
            } else if (selected.length > 1) {
                this.ctv = new ChannelToggleView({models: selected});
                $("#channelToggle").empty().append(this.ctv.render().el)
            }
        }
    });


    var InfoPanelView = Backbone.View.extend({

        template: _.template($("#info_panel_template").html()),
        xywh_template: _.template($("#xywh_panel_template").html()),

        initialize: function() {
            if (this.model) {
                this.listenTo(this.model, 'change:x change:y change:width change:height', this.render);
                this.listenTo(this.model, 'drag_resize', this.drag_resize);
            }
        },

        // just update x,y,w,h by rendering ONE template
        drag_resize: function(xywh) {
            $("#xywh_table").remove();
            var json = {'x': xywh[0], 'y':xywh[1], 'width':xywh[2], 'height':xywh[3]},
                xywh_html = this.xywh_template(json);
            this.$el.append(xywh_html);
        },

        // render BOTH templates
        render: function() {
            var json = this.model.toJSON(),
                html = this.template(json),
                xywh_html = this.xywh_template(json);
            this.$el.html(html + xywh_html);
            return this;
        }

    });


    // Coloured Buttons to Toggle Channels on/off.
    var ChannelToggleView = Backbone.View.extend({
        tagName: "div",
        template: _.template($('#channel_toggle_template').html()),

        initialize: function(opts) {
            // This View may apply to a single PanelModel or a list
            if (this.model) {
                this.listenTo(this.model, 'change:channels', this.render);
            }
            else if (opts.models) {
                this.models = opts.models;
                var self = this;
                _.each(this.models, function(m){
                    self.listenTo(m, 'change:channels', self.render);
                });
            }
        },

        events: {
            "click .channel-btn": "toggle_channel",
            "click .dropdown-menu a": "pick_colour"
        },

        pick_colour: function(e) {
            var colour = e.currentTarget.getAttribute('data-colour'),
                idx = $(e.currentTarget).parent().parent().attr('data-index');
            if (this.model) {
                this.model.save_channel(idx, 'color', colour);
            } else if (this.models) {
                _.each(this.models, function(m){
                    m.save_channel(idx, 'color', colour);
                });
            }
        },

        toggle_channel: function(e) {
            var idx = e.currentTarget.getAttribute('data-index');

            if (this.model) {
                this.model.toggle_channel(idx);
            } else if (this.models) {
                // 'flat' means that some panels have this channel on, some off
                var flat = $(e.currentTarget).hasClass('ch-btn-flat');
                _.each(this.models, function(m){
                    if(flat) {
                        m.toggle_channel(idx, true);
                    } else {
                        m.toggle_channel(idx);
                    }
                });
            }
        },

        render: function() {
            if (this.model) {
                var json = {'channels': this.model.get('channels')};
                var html = this.template(json);
                this.$el.html(html);
            } else if (this.models) {

                // Comare channels from each Panel Model to see if they are
                // compatible, and compile a summary json.
                var json = [],
                    compatible = true;

                _.each(this.models, function(m, i){
                    var chs = m.get('channels');
                    // start with a copy of the first image channels
                    if (json.length == 0) {
                        _.each(chs, function(c) {
                            json.push($.extend(true, {}, c));
                        });
                    } else{
                        // compare json summary so far with this channels
                        if (json.length != chs.length) {
                            compatible = false;
                        }
                        // if attributes don't match - show 'null' state
                        _.each(chs, function(c, i) {
                            if (json[i].color != c.color) {
                                json[i].color = 'ccc';
                            }
                            if (json[i].active != c.active) {
                                json[i].active = undefined;
                            }
                        });
                    }

                });
                if (compatible) {
                    var html = this.template({'channels':json});
                    this.$el.html(html);
                }
            }
            return this;
        }
    });

    // -------------- Selection Overlay Views ----------------------


    // SvgView uses ProxyRectModel to manage Svg Rects (raphael)
    // This converts between zoomed coordiantes of the html DOM panels
    // and the unzoomed SVG overlay.
    // Attributes of this model apply to the SVG canvas and are updated from
    // the PanelModel.
    // The SVG RectView (Raphael) notifies this Model via trigger 'drag' & 'dragStop'
    // and this is delegated to the PanelModel via trigger or set respectively.
    var ProxyRectModel = Backbone.Model.extend({

        initialize: function(opts) {
            this.panelModel = opts.panel;    // ref to the genuine PanelModel
            this.figureModel = opts.figure;

            this.renderFromModel();

            // Refresh c
            this.listenTo(this.figureModel, 'change:curr_zoom', this.renderFromModel);
            this.listenTo(this.panelModel, 'change:x change:y change:width change:height', this.renderFromModel);
            // when PanelModel is being dragged, but NOT by this ProxyRectModel...
            this.listenTo(this.panelModel, 'drag_resize', this.renderFromTrigger);
            this.listenTo(this.panelModel, 'change:selected', this.renderSelection);
            this.panelModel.on('destroy', this.clear, this);
            // listen to a trigger on this Model (triggered from Rect)
            this.listenTo(this, 'drag_xy', this.drag_xy);
            this.listenTo(this, 'drag_xy_stop', this.drag_xy_stop);
            this.listenTo(this, 'drag_resize', this.drag_resize);
            // listen to change to this model - update PanelModel
            this.listenTo(this, 'drag_resize_stop', this.drag_resize_stop);
        },

        // return the SVG x, y, w, h (converting from figureModel)
        getSvgCoords: function(coords) {
            var zoom = this.figureModel.get('curr_zoom') * 0.01,
                paper_top = (this.figureModel.get('canvas_height') - this.figureModel.get('paper_height'))/2;
                paper_left = (this.figureModel.get('canvas_width') - this.figureModel.get('paper_width'))/2;
                rect_x = (paper_left + 1 + coords.x) * zoom,
                rect_y = (paper_top + 1 + coords.y) * zoom,
                rect_w = coords.width * zoom,
                rect_h = coords.height * zoom;
            return {'x':rect_x, 'y':rect_y, 'width':rect_w, 'height':rect_h};
        },

        // return the Model x, y, w, h (converting from SVG coords)
        getModelCoords: function(coords) {
            var zoom = this.figureModel.get('curr_zoom') * 0.01,
                paper_top = (this.figureModel.get('canvas_height') - this.figureModel.get('paper_height'))/2;
                paper_left = (this.figureModel.get('canvas_width') - this.figureModel.get('paper_width'))/2;
                x = (coords.x/zoom) - paper_left - 1,
                y = (coords.y/zoom) - paper_top - 1,
                w = coords.width/zoom,
                h = coords.height/zoom;
            return {'x':x>>0, 'y':y>>0, 'width':w>>0, 'height':h>>0};
        },

        // called on trigger from the RectView, on drag of the whole rect OR handle for resize.
        // we simply convert coordinates and delegate to figureModel
        drag_xy: function(xy, save) {
            var zoom = this.figureModel.get('curr_zoom') * 0.01,
                dx = xy[0]/zoom,
                dy = xy[1]/zoom;

            this.figureModel.drag_xy(dx, dy, save);
        },

        // As above, but this time we're saving the changes to the Model
        drag_xy_stop: function(xy) {
            this.drag_xy(xy, true);
        },

        // Called on trigger from the RectView on resize. 
        // Need to convert from Svg coords to Model and notify the PanelModel without saving.
        drag_resize: function(xywh) {
            var coords = this.getModelCoords({'x':xywh[0], 'y':xywh[1], 'width':xywh[2], 'height':xywh[3]})
            this.panelModel.drag_resize(coords.x, coords.y, coords.width, coords.height);
        },

        // As above, but need to update the Model on changes to Rect (drag stop etc)
        drag_resize_stop: function(xywh) {
            var coords = this.getModelCoords({'x':xywh[0], 'y':xywh[1], 'width':xywh[2], 'height':xywh[3]})
            this.panelModel.save(coords);
        },

        // Called when the FigureModel zooms or the PanelModel changes coords.
        // Refreshes the RectView since that listens to changes in this ProxyModel
        renderFromModel: function() {
            this.set( this.getSvgCoords({
                'x': this.panelModel.get('x'),
                'y': this.panelModel.get('y'),
                'width': this.panelModel.get('width'),
                'height': this.panelModel.get('height')
            }) );
        },

        // While the Panel is being dragged (by the multi-select Rect), we need to keep updating
        // from the 'multiselectDrag' trigger on the model. RectView renders on change
        renderFromTrigger:function(xywh) {
            var c = this.getSvgCoords({
                'x': xywh[0],
                'y': xywh[1],
                'width': xywh[2],
                'height': xywh[3]
            });
            this.set( this.getSvgCoords({
                'x': xywh[0],
                'y': xywh[1],
                'width': xywh[2],
                'height': xywh[3]
            }) );
        },

        // When PanelModel changes selection - update and RectView will render change
        renderSelection: function() {
            this.set('selected', this.panelModel.get('selected'));
        },

        // Handle click (mousedown) on the RectView - changing selection.
        handleClick: function(event) {
            if (event.shiftKey) {
                this.figureModel.addSelected(this.panelModel);
            } else {
                this.figureModel.setSelected(this.panelModel);
            }
        },

        clear: function() {
            this.destroy();
        }

    });


    // This model underlies the Rect that is drawn around multi-selected panels
    // (only shown if 2 or more panels selected)
    // On drag or resize, we calculate how to move or resize the seleted panels.
    var MultiSelectRectModel = ProxyRectModel.extend({

        defaults: {
            x: 0,
            y: 0,
            width: 0,
            height: 0
        },

        initialize: function(opts) {
            this.figureModel = opts.figureModel;

            // listen to a trigger on this Model (triggered from Rect)
            this.listenTo(this, 'drag_xy', this.drag_xy);
            this.listenTo(this, 'drag_xy_stop', this.drag_xy_stop);
            this.listenTo(this, 'drag_resize', this.drag_resize);
            this.listenTo(this, 'drag_resize_stop', this.drag_resize_stop);
            this.listenTo(this.figureModel, 'change:selection', this.updateSelection);
            this.listenTo(this.figureModel, 'change:curr_zoom', this.updateSelection);

            // also listen for drag_xy coming from a selected panel
            this.listenTo(this.figureModel, 'drag_xy', this.update_xy);
        },


        // Need to re-draw on selection AND zoom changes
        updateSelection: function() {

            var min_x = 100000, max_x = -10000,
                min_y = 100000, max_y = -10000

            var selected = this.figureModel.getSelected();
            if (selected.length < 2){

                this.set({
                    'x': 0,
                    'y': 0,
                    'width': 0,
                    'height': 0,
                    'selected': false
                });
                return;
            }

            for (var i=0; i<selected.length; i++) {
                var panel = selected[i],
                    x = panel.get('x'),
                    y = panel.get('y'),
                    w = panel.get('width'),
                    h = panel.get('height');
                min_x = Math.min(min_x, x);
                max_x = Math.max(max_x, x+w);
                min_y = Math.min(min_y, y);
                max_y = Math.max(max_y, y+h);
            };

            this.set( this.getSvgCoords({
                'x': min_x,
                'y': min_y,
                'width': max_x - min_x,
                'height': max_y - min_y
            }) );

            // Rect SVG will be notified and re-render
            this.set('selected', true);
        },


        // Called when we are notified of drag_xy on one of the Panels
        update_xy: function(dxdy) {
            if (! this.get('selected')) return;     // if we're not visible, ignore

            var svgCoords = this.getSvgCoords({
                'x': dxdy[0],
                'y': dxdy[1],
                'width': 0,
                'height': 0,
            });
            this.set({'x':svgCoords.x, 'y':svgCoords.y});
        },

        // RectView drag is delegated to Panels to update coords (don't save)
        drag_xy: function(dxdy, save) {
            // we just get [x,y] but we need [x,y,w,h]...
            var x = dxdy[0] + this.get('x'),
                y = dxdy[1] + this.get('y');
            var xywh = [x, y, this.get('width'), this.get('height')];
            this.notifyModelofDrag(xywh, save);
        },

        // As above, but Save is true since we're done dragging
        drag_xy_stop: function(dxdy, save) {
            this.drag_xy(dxdy, true);
            // Have to keep our proxy model in sync
            this.set({
                'x': dxdy[0] + this.get('x'),
                'y': dxdy[1] + this.get('y')
            });
        },

        // While the multi-select RectView is being dragged, we need to calculate the new coords
        // of all selected Panels, based on the start-coords and the current coords of
        // the multi-select Rect.
        drag_resize: function(xywh, save) {
            this.notifyModelofDrag(xywh, save);
        },

        // RectView dragStop is delegated to Panels to update coords (with save 'true')
        drag_resize_stop: function(xywh) {
            this.notifyModelofDrag(xywh, true);

            this.set({
                'x': xywh[0],
                'y': xywh[1],
                'width': xywh[2],
                'height': xywh[3]
            });
        },

        // While the multi-select RectView is being dragged, we need to calculate the new coords
        // of all selected Panels, based on the start-coords and the current coords of
        // the multi-select Rect.
        notifyModelofDrag: function(xywh, save) {
            var startCoords = this.getModelCoords({
                'x': this.get('x'),
                'y': this.get('y'),
                'width': this.get('width'),
                'height': this.get('height')
            });
            var dragCoords = this.getModelCoords({
                'x': xywh[0],
                'y': xywh[1],
                'width': xywh[2],
                'height': xywh[3]
            });

            // var selected = this.figureModel.getSelected();
            // for (var i=0; i<selected.length; i++) {
            //     selected[i].multiselectdrag(startCoords.x, startCoords.y, startCoords.width, startCoords.height,
            //         dragCoords.x, dragCoords.y, dragCoords.width, dragCoords.height, save);
            this.figureModel.multiselectdrag(startCoords.x, startCoords.y, startCoords.width, startCoords.height,
                    dragCoords.x, dragCoords.y, dragCoords.width, dragCoords.height, save);
            // };
        },

        // Ignore mousedown
        handleClick: function(event) {

        }
    });

    // var ProxyRectModelList = Backbone.Collection.extend({
    //     model: ProxyRectModel
    // });

    var SvgView = Backbone.View.extend({

        initialize: function(opts) {

            var self = this,
                canvas_width = this.model.get('canvas_width'),
                canvas_height = this.model.get('canvas_height');

            // Create <svg> canvas
            this.raphael_paper = Raphael("canvas_wrapper", canvas_width, canvas_height);

            // this.panelRects = new ProxyRectModelList();

            // Add global click handler
            $("#canvas_wrapper>svg").mousedown(function(event){
                self.handleClick(event);
            });

            // If a panel is added...
            this.model.panels.on("add", this.addOne, this);
            // TODO remove on destroy

            var multiSelectRect = new MultiSelectRectModel({figureModel: this.model}),
                rv = new RectView({'model':multiSelectRect, 'paper':this.raphael_paper});
            rv.selected_line_attrs = {'stroke-width': 1, 'stroke':'#4b80f9'};
        },

        // A panel has been added - We add a corresponding Raphael Rect 
        addOne: function(m) {

            var rectModel = new ProxyRectModel({panel: m, figure:this.model});
            new RectView({'model':rectModel, 'paper':this.raphael_paper});
        },

        // TODO
        remove: function() {
            // TODO: remove from svg, remove event handlers etc.
        },

        // We simply re-size the Raphael svg itself - Shapes have their own zoom listeners
        setZoom: function() {
            var zoom = this.model.get('curr_zoom') * 0.01,
                newWidth = parseInt(this.orig_width * zoom),
                newHeight = parseInt(this.orig_height * zoom);

            this.raphael_paper.setSize(newWidth, newHeight);
        },

        // Any mouse click (mousedown) that isn't captured by Panel Rect clears selection
        handleClick: function(event) {
            this.model.clearSelected();
        }
    });

