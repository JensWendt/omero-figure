/* jshint node: true */

module.exports = function (grunt) {
  "use strict";

  grunt.initConfig({
      pkg: grunt.file.readJSON('package.json')
    , jshint: {
        all: [
            "Gruntfile.js"
          , "static/figure/js/*.js"
        ]
      , options: {
          jshintrc: '.jshintrc'
        },
      }
    , jasmine: {
        src: [
            "static/figure/3rdparty/jquery-1.7.2.js",
            "static/figure/3rdparty/underscore.js",
            "static/figure/3rdparty/backbone.js",
            "static/figure/js/*.js"
        ]
      , options: {
          specs: "spec/*.js"
        // , vendor: "vendor/**/*.js"
      }
    },
    jst: {
      compile: {
        files: {
          "static/figure/js/templates.js": [
            "static/figure/templates/*.html",
            "static/figure/templates/**/*.html"
          ]
        }
      }
    },
    watch: {
      scripts: {
        files: ['static/figure/templates/*.html', 'static/figure/templates/**/*.html'],
        tasks: ['jst'],
        // options: {
        //   spawn: false,
        // },
      },
    },
    concat: {
      js: {
        src: ['static/figure/js/models/*.js', 'static/figure/js/views/*.js', 'static/figure/js/app.js'],
        dest: 'static/figure/js/figure.js',
      },
    },
    replace: {
      dist: {
        options: {
          patterns: [
            {
              json: {
                '{% load url from future %}': '',
                '{% include "webgateway/base/includes/script_src_jquery.html" %}':
                    '<script type="text/javascript" src="//code.jquery.com/jquery-1.7.2.min.js"></script>',
                '{% include "webgateway/base/includes/jquery-ui.html" %}':
                    '<script type="text/javascript" src="//code.jquery.com/ui/1.8.19/jquery-ui.js"></script>' +
                    '<link rel="stylesheet" href="//code.jquery.com/ui/1.8.19/themes/smoothness/jquery-ui.css" type="text/css" />',
                "{% url 'figure_index' %}":
                    "",
                "{% url 'save_web_figure' %}":
                    "/figure/save_web_figure/",
                "{% url 'list_web_figures' %}":
                    "static/json/list_web_figures.json"
                }
            }
          ],
          usePrefix: false,
        },
        files: [
          {expand: true, flatten: true, src: ['templates/figure/index.html'], dest: 'demo/'}
        ]
      }
    },
  })

  grunt.loadNpmTasks('grunt-contrib-jshint')
  grunt.loadNpmTasks('grunt-contrib-jasmine')
  grunt.loadNpmTasks('grunt-contrib-jst');
  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-contrib-concat');
  grunt.loadNpmTasks('grunt-replace');

  grunt.registerTask('test', ['jshint', 'jasmine'])
  grunt.registerTask('default', ['test'])

  // create a static 'demo' version of app
  grunt.registerTask('demo', [
      'replace'
  ]);
};
