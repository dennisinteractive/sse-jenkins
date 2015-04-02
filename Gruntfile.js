module.exports = function(grunt) {
  'use strict';

  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),

    browserify: {
      dist: {
        src: './sse-client.js',
        dest: 'dist/sse-client.js'
      }
    },

    wrap: {
      basic: {
        options: {
          wrapper: ['(function(f) { f() }(function(){var define,module,exports;return ', '}));'],
          separator: ''
        },
        src: ['<%= browserify.dist.dest %>'],
        dest: './'
      }
    },

    uglify: {
      options: {
        sourceMap: true
      },
      dist: {
        files: {
          'dist/sse-client.min.js': ['<%= browserify.dist.dest %>']
        }
      }
    },

    cssmin: {
      options: {
        shorthandCompacting: false
      },
      dist: {
        files: {
          'dist/sse-client.css': [
            './node_modules/humane-js/themes/libnotify.css',
            'sse-client.css'
          ]
        }
      }
    },

    jshint: {
      options: {
        jshintrc : '.jshintrc'
      },
      files: [
        'Gruntfile.js',
        './app.js',
        './sse-client.js'
      ]
    },

    watch: {
      files: ['<%= jshint.files %>', 'overrides.css'],
      tasks: ['default']
    },

    bytesize: {
      dist: {
        src: ['dist/*.js', 'dist/*.css']
      }
    }
  });

  grunt.loadNpmTasks('grunt-browserify');
  grunt.loadNpmTasks('grunt-bytesize');
  grunt.loadNpmTasks('grunt-contrib-cssmin');
  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-contrib-uglify');
  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-wrap');

  grunt.registerTask('test', [
    'jshint'
  ]);
  grunt.registerTask('default', [
    'test',
    'browserify',
    'wrap',
    'uglify',
    'cssmin',
    'bytesize'
  ]);
};
