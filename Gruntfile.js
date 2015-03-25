module.exports = function(grunt) {
  'use strict';

  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),

    browserify: {
      dist: {
        options: {
          // transform: ['brfs'],
        },
        src: './<%= pkg.name %>.js',
        dest: 'dist/<%= pkg.name %>.js'
      }
    },

    wrap: {
      basic: {
        options: {
          wrapper: ['(function(f) { f() }(function(){var define,module,exports;return ', '}));'],
          separator: '',
        },
        src: ['dist/<%= pkg.name %>.js'],
        dest: './'
      }
    },

    eol: {
      dist: {
        options: {
          replace: true
        },
        files: {
          src: ['dist/**']
        }
      }
    },

    uglify: {
      dist: {
        files: {
          'dist/<%= pkg.name %>.min.js': ['<%= browserify.dist.dest %>']
        }
      }
    },

    jshint: {
      options: {
        jshintrc : '.jshintrc',
      },
      files: [
        'Gruntfile.js',
        '<%= pkg.name %>.js'
      ]
    },

    watch: {
      files: ['<%= jshint.files %>', 'overrides.css'],
      tasks: ['default']
    },

    bytesize: {
      dist: {
        src: ['dist/<%= pkg.name %>.*']
      }
    }
  });

  grunt.loadNpmTasks('grunt-browserify');
  grunt.loadNpmTasks('grunt-bytesize');
  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-contrib-uglify');
  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-eol');
  grunt.loadNpmTasks('grunt-wrap');

  grunt.registerTask('test', [
    'jshint'
  ]);
  grunt.registerTask('default', [
    'test',
    'browserify',
    'wrap',
    'eol',
    'uglify',
    'bytesize'
  ]);
};
