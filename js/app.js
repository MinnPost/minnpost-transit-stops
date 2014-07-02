/**
 * Main application file for: minnpost-transit-stops
 *
 * This pulls in all the parts
 * and creates the main object for the application.
 */

// Create main application
define('minnpost-transit-stops', [
  'jquery', 'underscore', 'ractive', 'ractive-events-tap', 'leaflet', 'mpConfig', 'mpFormatters', 'mpMaps', 
  'helpers',
  
  
  'text!templates/application.mustache'
], function(
  $, _, Ractive, RactiveEventsTap, L, mpConfig, mpFormatters, mpMaps, 
  helpers,
  
  
  tApplication
  ) {

  // Constructor for app
  var App = function(options) {
    this.options = _.extend(this.defaultOptions, options);
    this.el = this.options.el;
    this.$el = $(this.el);
    this.$ = function(selector) { return this.$el.find(selector); };
    this.$content = this.$el.find('.content-container');
    this.loadApp();
  };

  // Extend with custom methods
  _.extend(App.prototype, {
    // Start function
    start: function() {
      var thisApp = this;

      
      // Create main application view
      this.mainView = new Ractive({
        el: this.$el,
        template: tApplication,
        data: {
        },
        partials: {
        }
      });
      

      
      // Run examples.  Please remove for real application.
      //
      // Because of how Ractive initializes and how Highcharts work
      // there is an inconsitency of when the container for the chart
      // is ready and when highcharts loads the chart.  So, we put a bit of
      // of a pause.
      //
      // In production, intializing a chart should be tied to data which
      // can be used with a Ractive observer.
      //
      // This should not happen with underscore templates.
      _.delay(function() { thisApp.makeExamples(); }, 400);
      
    },

    
    // Make some example depending on what parts were asked for in the
    // templating process.  Remove, rename, or alter this.
    makeExamples: function() {
      

      

      
      var markerMap = mpMaps.makeLeafletMap('example-markers-features-map');
      var tooltipControl = new mpMaps.TooltipControl();
      markerMap.setZoom(9);
      markerMap.addControl(tooltipControl);

      // Markers
      var iconCinema = mpMaps.makeMakiIcon('cinema', 'm');
      var iconBlank = mpMaps.makeMakiIcon('', 's', '222222');
      L.marker(mpMaps.minneapolisPoint, { icon: iconCinema })
        .addTo(markerMap).bindPopup('Minneapolis', {
          closeButton: false
        });
      L.marker(mpMaps.stPaulPoint, { icon: iconBlank })
        .addTo(markerMap).bindPopup('St. Paul', {
          closeButton: false
        });

      // GeoJSON example
      $.getJSON('http://boundaries.minnpost.com/1.0/boundary/27-county-2010/?callback=?', function(data) {
        if (data.simple_shape) {
          L.geoJson(data.simple_shape, {
            style: mpMaps.mapStyle,
            onEachFeature: function(feature, layer) {
              layer.on('mouseover', function(e) {
                tooltipControl.update('Hennepin County');
              });
              layer.on('mouseout', function(e) {
                tooltipControl.hide();
              });
            }
          }).addTo(markerMap);
        }
      });
      
    },
    

    // Default options
    defaultOptions: {
      projectName: 'minnpost-transit-stops',
      remoteProxy: null,
      el: '.minnpost-transit-stops-container',
      availablePaths: {
        local: {
          
          css: ['.tmp/css/main.css'],
          images: 'images/',
          data: 'data/'
        },
        build: {
          css: [
            '//netdna.bootstrapcdn.com/font-awesome/4.0.3/css/font-awesome.css',
            'dist/minnpost-transit-stops.libs.min.css',
            'dist/minnpost-transit-stops.latest.min.css'
          ],
          ie: [
            'dist/minnpost-transit-stops.libs.min.ie.css',
            'dist/minnpost-transit-stops.latest.min.ie.css'
          ],
          images: 'dist/images/',
          data: 'dist/data/'
        },
        deploy: {
          css: [
            '//netdna.bootstrapcdn.com/font-awesome/4.0.3/css/font-awesome.css',
            'https://s3.amazonaws.com/data.minnpost/projects/minnpost-transit-stops/minnpost-transit-stops.libs.min.css',
            'https://s3.amazonaws.com/data.minnpost/projects/minnpost-transit-stops/minnpost-transit-stops.latest.min.css'
          ],
          ie: [
            'https://s3.amazonaws.com/data.minnpost/projects/minnpost-transit-stops/minnpost-transit-stops.libs.min.ie.css',
            'https://s3.amazonaws.com/data.minnpost/projects/minnpost-transit-stops/minnpost-transit-stops.latest.min.ie.css'
          ],
          images: 'https://s3.amazonaws.com/data.minnpost/projects/minnpost-transit-stops/images/',
          data: 'https://s3.amazonaws.com/data.minnpost/projects/minnpost-transit-stops/data/'
        }
      }
    },

    // Load up app
    loadApp: function() {
      this.determinePaths();
      this.getLocalAssests(function(map) {
        this.renderAssests(map);
        this.start();
      });
    },

    // Determine paths.  A bit hacky.
    determinePaths: function() {
      var query;
      this.options.deployment = 'deploy';

      if (window.location.host.indexOf('localhost') !== -1) {
        this.options.deployment = 'local';

        // Check if a query string forces something
        query = helpers.parseQueryString();
        if (_.isObject(query) && _.isString(query.mpDeployment)) {
          this.options.deployment = query.mpDeployment;
        }
      }

      this.options.paths = this.options.availablePaths[this.options.deployment];
    },

    // Get local assests, if needed
    getLocalAssests: function(callback) {
      var thisApp = this;

      // If local read in the bower map
      if (this.options.deployment === 'local') {
        $.getJSON('bower.json', function(data) {
          callback.apply(thisApp, [data.dependencyMap]);
        });
      }
      else {
        callback.apply(this, []);
      }
    },

    // Rendering tasks
    renderAssests: function(map) {
      var isIE = (helpers.isMSIE() && helpers.isMSIE() <= 8);

      // Add CSS from bower map
      if (_.isObject(map)) {
        _.each(map, function(c, ci) {
          if (c.css) {
            _.each(c.css, function(s, si) {
              s = (s.match(/^(http|\/\/)/)) ? s : 'bower_components/' + s + '.css';
              $('head').append('<link rel="stylesheet" href="' + s + '" type="text/css" />');
            });
          }
          if (c.ie && isIE) {
            _.each(c.ie, function(s, si) {
              s = (s.match(/^(http|\/\/)/)) ? s : 'bower_components/' + s + '.css';
              $('head').append('<link rel="stylesheet" href="' + s + '" type="text/css" />');
            });
          }
        });
      }

      // Get main CSS
      _.each(this.options.paths.css, function(c, ci) {
        $('head').append('<link rel="stylesheet" href="' + c + '" type="text/css" />');
      });
      if (isIE) {
        _.each(this.options.paths.ie, function(c, ci) {
          $('head').append('<link rel="stylesheet" href="' + c + '" type="text/css" />');
        });
      }

      // Add a processed class
      this.$el.addClass('processed');
    }
  });

  return App;
});


/**
 * Run application
 */
require(['jquery', 'minnpost-transit-stops'], function($, App) {
  $(document).ready(function() {
    var app = new App();
  });
});
