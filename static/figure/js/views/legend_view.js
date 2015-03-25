
// Copyright (c) 2015 University of Dundee.

// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as
// published by the Free Software Foundation, either version 3 of the
// License, or (at your option) any later version.

// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Affero General Public License for more details.

// You should have received a copy of the GNU Affero General Public License
// along with this program.  If not, see <http://www.gnu.org/licenses/>.


var LegendView = Backbone.View.extend({

        el: $("#js-legend"),

        // template: JST["static/figure/templates/paper_setup_modal_template.html"],

        model:FigureModel,

        editing: false,

        initialize: function() {

            this.listenTo(this.model,
                'change:x change:legend', this.render);

            this.render();
        },

        events: {
            "click .edit-legend": "editLegend",
            "click .cancel-legend": "cancelLegend",
            "click .save-legend": "saveLegend",
            "click .collapse-legend": "collapseLegend",
            "click .expand-legend": "expandLegend",
            "click .markdown-info": "markdownInfo",
        },

        markdownInfo: function(event) {
            event.preventDefault();
            $("#markdownInfoModal").modal('show');
        },

        collapseLegend: function(event) {
            this.renderCollapsed(true);
            this.model.set("legend_collapsed", true);
        },

        expandLegend: function(event) {
            this.renderCollapsed(false);
            this.model.set("legend_collapsed", false);
        },

        saveLegend: function(event) {
            event.preventDefault();
            var legendTxt = $("#js-legend textarea").val();
            this.model.save("legend", legendTxt);
            this.editing = false;
            this.render();
        },

        editLegend: function(event) {
            event.preventDefault();
            this.editing = true;
            if (this.model.get("legend_collapsed")) {
                // will trigger render
                this.model.set("legend_collapsed", false);
            } else {
                this.render();
            }
            this.render();
        },

        cancelLegend: function(event) {
            event.preventDefault();
            this.editing = false;
            this.render();
        },

        renderCollapsed: function(collapsed) {
            var $panel = $('.panel', self.el);
            if (collapsed) {
                $panel.addClass('legend-collapsed');
                $panel.removeClass('legend-expanded');
            } else {
                $panel.removeClass('legend-collapsed');
                $panel.addClass('legend-expanded');
            }
        },

        render: function() {

            var self = this,
                legendText = this.model.get('legend') || "",
                legendCollapsed = this.model.get('legend_collapsed'),
                $edit = $('.edit-legend', self.el),
                $save = $('.save-legend', self.el),
                $cancel = $('.cancel-legend', self.el),
                $panel = $('.panel', self.el),
                $legend = $('.legend', self.el);

            self.renderCollapsed(legendCollapsed);

            // if we're editing...
            if (self.editing) {
                // show 'cancel' and 'save' buttons
                $edit.hide();
                $save.show();
                $cancel.show();

                $panel.addClass('editing');
                $panel.show();
                var html = '<textarea class="form-control" rows="7" style="resize:none">'
                            + legendText + '</textarea>';
                $legend.html(html);
            } else {
                // ...only show 'edit' button
                $edit.show();
                $save.hide();
                $cancel.hide();

                $panel.removeClass('editing');
                if (legendText.length === 0) {
                    $panel.hide();
                } else {
                    $panel.show();
                    legendText = markdown.toHTML( legendText );
                    $legend.html(legendText);
                }
            }
        }
    });
