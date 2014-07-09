/**
 * Main application file for: minnpost-transit-stops
 *
 * This pulls in all the parts
 * and creates the main object for the application.
 */

// Create main application
define('minnpost-transit-stops', [
  'jquery', 'underscore', 'ractive', 'ractive-events-tap', 'topojson', 'chroma',
  'leaflet', 'simple-statistics', 'highcharts', 'mpConfig', 'mpFormatters',
  'mpMaps', 'mpHighcharts',
  'helpers', 'text!templates/application.mustache'
], function(
  $, _, Ractive, RactiveEventsTap, topojson, chroma, L, ss, Highcharts,
  mpConfig, mpFormatters, mpMaps, mpHighcharts,
  helpers, tApplication
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
      this.showProp = 'score_by_pop_area';
      this.showProp2 = 'population';

      // Create main application view
      this.mainView = new Ractive({
        el: this.$el,
        template: tApplication,
        data: {
          showProp: this.showProp,
          showProp2: this.showProp2
        },
        partials: {
        }
      });

      // DOM events
      this.mainView.observe('showProp', function(n, o) {
        thisApp.showProp = n;
        thisApp.changeProp();
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
      _.delay(function() { thisApp.getData(); }, 400);

    },

    // Get data
    getData: function() {
      var thisApp = this;

      $.getJSON('data/neighborhood-stop-data.topo.json', function(data) {
        thisApp.nData = topojson.feature(data, data.objects['neighborhood-stop-data.geo']);
        thisApp.mainView.set('properties', _.keys(thisApp.nData.features[0].properties));
        thisApp.makeMap();
      });
    },

    // Make map
    makeMap: function() {
      var thisApp = this;
      this.map = mpMaps.makeLeafletMap('prop-map');
      this.tooltipControl = new mpMaps.TooltipControl();
      this.map.addControl(this.tooltipControl);

      // Add neighborhoods to map
      this.nLayers = L.geoJson(this.nData, {
        style: mpMaps.mapStyle,
        onEachFeature: function(feature, layer) {
          layer.on('mouseover', function(e) {
            thisApp.tooltipControl.update(feature.properties.Name + '<br>' + thisApp.showProp + ': ' + feature.properties[thisApp.showProp]);
          });
          layer.on('mouseout', function(e) {
            thisApp.tooltipControl.hide();
          });
        }
      });
      this.nLayers.addTo(thisApp.map);

      this.map.fitBounds(thisApp.nLayers.getBounds());
      this.changeProp();
    },

    // Change property to look at
    changeProp: function() {
      var thisApp = this;
      var valuesDist, i, j;

      // Stats
      var values = _.sortBy(_.map(this.nData.features, function(f, fi) {
        return f.properties[thisApp.showProp];
      }));
      var mean = ss.mean(values);
      var stdDev = ss.standard_deviation(values);
      var binCount = Math.ceil(Math.sqrt(values.length)) * 5;

      // Color
      var scale = chroma.scale('Blues').domain([0, 1, 2, 3], 7, 'e');

      // Update map
      this.nLayers.setStyle(function(feature, layer) {
        return {
          color: scale(Math.abs((feature.properties[thisApp.showProp] - mean) / stdDev)),
          fillColor: scale(Math.abs((feature.properties[thisApp.showProp] - mean) / stdDev)),
          fillOpacity: 0.8
        };
      });

      // Make values chart
      valuesDist = _.sortBy(_.map(this.nData.features, function(f, fi) {
        return [f.properties.Name, f.properties[thisApp.showProp]];
      }), function(v, vi) {
        return v[1];
      });
      mpHighcharts.makeChart('#prop-values', $.extend(true, {}, mpHighcharts.columnOptions, {
        legend: { enabled: false },
        xAxis: {
          type: 'category',
          labels: { rotation: -45 }
        },
        series: [{
          name: this.showProp,
          data: valuesDist
        }]
      }));

      // Make distribution chart
      var bins = [];
      var span = values[values.length - 1] - values[0];
      var binSpan = (span / binCount);
      var b;
      for (i = 0; i < values[values.length - 1]; i += binSpan) {
        b = 0;

        for (j = 0; j < values.length - 1; j++) {
          if (values[j] >= i && values[j] < i + binSpan) {
            b++;
          }
        }

        bins.push([i + ' - ' + (i + binSpan), b]);
      }

      mpHighcharts.makeChart('#prop-distribution', $.extend(true, {}, mpHighcharts.columnOptions, {
        legend: { enabled: false },
        xAxis: {
          type: 'category',
          labels: { rotation: -45 }
        },
        series: [{
          name: this.showProp,
          data: bins
        }]
      }));


      // Stuff
      var features = _.filter(_.sortBy(this.nData.features, function(f, fi) {
        return f.properties[thisApp.showProp];
      }), function(f, fi) {
        return (_.isNumber(f.properties[thisApp.showProp]) &&
          ['Mid - City Industrial', 'Humboldt Industrial Area', 'Camden Industrial'].indexOf(f.properties.Name) === -1);
      });
      values = _.map(features, function(f, fi) {
        return f.properties[thisApp.showProp];
      });
      var northValues = _.map(_.filter(features, function(f, fi) {
        return (['Near North', 'Camden'].indexOf(f.properties.community_area) !== -1);
      }), function(f, fi) {
        return f.properties[thisApp.showProp];
      });
      var nonNorthValues = _.map(_.filter(features, function(f, fi) {
        return (['Near North', 'Camden'].indexOf(f.properties.community_area) === -1);
      }), function(f, fi) {
        return f.properties[thisApp.showProp];
      });

      console.log(northValues);
      console.log('All Mean: ' + ss.mean(values));
      console.log('All Median: ' + ss.mean(values));
      console.log('All Std Dev: ' + ss.standard_deviation(values));
      console.log('North Mean: ' + ss.mean(northValues));
      console.log('North Median: ' + ss.mean(northValues));
      console.log('North Std Dev: ' + ss.standard_deviation(northValues));
      console.log('T Test of North to all mean: ' + ss.t_test(northValues, ss.mean(values)));
      console.log('T Test of North and non-North: ' + ss.t_test_two_sample(northValues, nonNorthValues, 0));
      console.log('T Test of North and all: ' + ss.t_test_two_sample(northValues, values, 0));

      console.log('Manual T of North to all mean: ' + (
        (ss.mean(northValues) - ss.mean(values)) /
        (ss.standard_deviation(northValues) / Math.sqrt(northValues.length))
      ));

      console.log('Sig Stat of North to all mean: ' + (
        (ss.mean(northValues) - ss.mean(values)) /
        (ss.standard_deviation(northValues))
      ));


      console.log('T Test of all to North mean: ' + ss.t_test(values, ss.mean(northValues)));

      console.log('Manual T Test: ' + (
        (ss.mean(northValues) - ss.mean(values)) /
        (Math.sqrt(
          (ss.variance(northValues) / northValues.length) +
          (ss.variance(values) / values.length)
        ))
      ));
      console.log('Degrees of freedom for all and North: ' + (northValues.length + values.length - 2));

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
