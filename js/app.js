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
  'helpers', 'text!templates/application.mustache',
  'text!templates/map-tooltip.underscore'
], function(
  $, _, Ractive, RactiveEventsTap, topojson, chroma, L, ss, Highcharts,
  mpConfig, mpFormatters, mpMaps, mpHighcharts,
  helpers, tApplication, tMapTooltip
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
      this.mapTooltipView = _.template(tMapTooltip);

      // Create main application view
      this.mainView = new Ractive({
        el: this.$el,
        template: tApplication,
        data: {
          originalShelterWeight: 5,
          originalHeatWeight: 4,
          originalLightWeight: 3,
          originalBenchWeight: 2,
          originalSignWeight: 1,
          shelterWeight: 5,
          heatWeight: 4,
          lightWeight: 3,
          benchWeight: 2,
          signWeight: 1,
          formatters: mpFormatters
        },
        partials: {
        }
      });
      _.delay(function() { thisApp.getData(); }, 800);

    },

    // Get data
    getData: function() {
      var thisApp = this;

      helpers.getLocalData('neighborhood-stop-data.topo.json', this.options).done(function(data) {
        thisApp.nDataOutliers = topojson.feature(data, data.objects['neighborhood-stop-data.geo']);
        thisApp.nData = _.clone(thisApp.nDataOutliers);
        thisApp.nData.features = _.filter(thisApp.nData.features, function(f, fi) {
          return (f.properties.outlier !== 1);
        });
        thisApp.nNorth = topojson.merge(data,
          _.filter(data.objects['neighborhood-stop-data.geo'].geometries, function(o, oi) {
          return (o.properties.north);
        }));
        thisApp.makeStats();
        thisApp.makeMaps();
        thisApp.makeCharts();
      });
    },

    // Make stats
    makeStats: function() {
      var thisApp = this;

      // Counts
      this.mainView.set('countShelter', _.reduce(this.nData.features, function(m, f, fi) {
        return m + f.properties.shelter;
      }, 0));
      this.mainView.set('countLight', _.reduce(this.nData.features, function(m, f, fi) {
        return m + f.properties.light;
      }, 0));
      this.mainView.set('countHeat', _.reduce(this.nData.features, function(m, f, fi) {
        return m + f.properties.heat;
      }, 0));
      this.mainView.set('countBench', _.reduce(this.nData.features, function(m, f, fi) {
        return m + f.properties.bench;
      }, 0));
      this.mainView.set('countSign', _.reduce(this.nData.features, function(m, f, fi) {
        return m + f.properties.sign;
      }, 0));

      // Make score
      this.nData.features = _.map(this.nData.features, function(f, fi) {
        f.properties.originalScore = (
          (f.properties.sign * thisApp.mainView.get('originalSignWeight')) +
          (f.properties.bench * thisApp.mainView.get('originalBenchWeight')) +
          (f.properties.light * thisApp.mainView.get('originalLightWeight')) +
          (f.properties.heat * thisApp.mainView.get('originalHeatWeight')) +
          (f.properties.shelter * thisApp.mainView.get('originalShelterWeight'))
        );
        return f;
      });

      // Means
      this.mainView.set('meanNorth', ss.mean(
        _.map(_.filter(this.nData.features, function(f, fi) {
          return (!!f.properties.north);
        }), function(f, fi) {
          return f.properties.originalScore / f.properties.population;
        })
      ));
      this.mainView.set('meanNonNorth', ss.mean(
        _.map(_.filter(this.nData.features, function(f, fi) {
          return (!f.properties.north);
        }), function(f, fi) {
          return f.properties.originalScore / f.properties.population;
        })
      ));
      this.mainView.set('meanAll', ss.mean(
        _.map(this.nData.features, function(f, fi) {
          return f.properties.originalScore / f.properties.population;
        })
      ));
    },

    // Make charts
    makeCharts: function() {
      var thisApp = this;
      var dataNorth, dataNonNorth;
      this.charts = {};

      // Score per pop histogram
      dataNorth = [];
      dataNonNorth = [];
      _.each(this.nData.features, function(f, fi) {
        var bin = f.properties.originalScore / f.properties.population * 1000;
        var data = (f.properties.north) ? dataNorth : dataNonNorth;
        bin = Math.round(bin / 3) * 3;
        data[bin] = data[bin] || [0, 0];
        data[bin][0] = bin;
        data[bin][1] = data[bin][1] + 1;
      });
      dataNorth = _.values(dataNorth);
      dataNonNorth = _.values(dataNonNorth);
      this.charts.scoreHistogram = mpHighcharts.makeChart('#chart-score-pop-histogram',
        $.extend(true, {}, mpHighcharts.columnOptions, {

          plotOptions: {
            column: {
              stacking: 'normal',
              shadow: false,
              borderWidth: 0.5,
              borderColor: '#666',
              pointPadding: 0,
              groupPadding: 0
            }
          },
          series: [{
            name: 'North',
            data: dataNorth
          },
          {
            name: 'Non-north',
            data: dataNonNorth
          }]
        })
      );

      // Score by non-white scatterplot
      this.charts.scoreNonWhite = mpHighcharts.makeChart('#chart-score-non-white',
        $.extend(true, {}, mpHighcharts.scatterOptions, {
          series: [{
            name: 'Score by Non-white population',
            data: _.map(this.nData.features, function(f, fi) {
              return [f.properties.non_white_per, (f.properties.originalScore / f.properties.population * 1000)];
            })
          }]
        })
      );

      // Score by per employed scatterplot
      this.charts.scoreNonWhite = mpHighcharts.makeChart('#chart-score-employed',
        $.extend(true, {}, mpHighcharts.scatterOptions, {
          series: [{
            name: 'Score by Employed population',
            data: _.map(this.nData.features, function(f, fi) {
              return [f.properties.employed_per, (f.properties.originalScore / f.properties.population * 1000)];
            })
          }]
        })
      );

      // Score by per employed scatterplot
      this.charts.scoreNonWhite = mpHighcharts.makeChart('#chart-score-ons',
        $.extend(true, {}, mpHighcharts.scatterOptions, {
          series: [{
            name: 'Score by Ons',
            data: _.map(this.nData.features, function(f, fi) {
              return [f.properties.ons, f.properties.originalScore];
            })
          }]
        })
      );
    },

    // Make map
    makeMaps: function() {
      var thisApp = this;
      this.maps = {};

      // Neighborhood north map
      this.maps.nNorth = this.makeNeighborhoodMap(
        'map-neighborhoods-north', true, true,
        function(f, layer) {
          return _.extend({}, mpMaps.mapStyle, {
            fillOpacity: (!f.properties.north) ? 0 : 0.9
          });
        },
        function(f, layer, e) {
          return thisApp.mapTooltipView({
            name: f.properties.Name,
            label: 'Community area',
            value: f.properties.community_area
          });
        }
      );

      // Neighborhood outliers map
      this.maps.nOutlier = this.makeNeighborhoodMap(
        'map-neighborhoods-outliers', true, false,
        function(f, layer) {
          return _.extend({}, mpMaps.mapStyle, {
            fillOpacity: (!f.properties.outlier) ? 0 : 0.9
          });
        },
        function(f, layer, e) {
          return thisApp.mapTooltipView({
            name: f.properties.Name
          });
        }
      );

      // Shelters map
      this.maps.shelters = {};
      this.maps.shelters.scale = this.makeColorScale('shelter');
      _.extend(this.maps.shelters, this.makeNeighborhoodMap(
        'map-shelters', false, true,
        function(f, layer) {
          return _.extend({}, mpMaps.mapStyle, {
            fillOpacity: 0.75,
            fillColor: thisApp.maps.shelters.scale(f.properties.shelter)
          });
        },
        function(f, layer, e) {
          return thisApp.mapTooltipView({
            name: f.properties.Name,
            label: 'Shelters',
            value: f.properties.shelter
          });
        }
      ));

      // Score map
      this.maps.scores = {};
      this.maps.scores.scale = this.makeColorScale('originalScore');
      _.extend(this.maps.scores, this.makeNeighborhoodMap(
        'map-scores', false, true,
        function(f, layer) {
          return _.extend({}, mpMaps.mapStyle, {
            fillOpacity: 0.75,
            fillColor: thisApp.maps.scores.scale(f.properties.originalScore)
          });
        },
        function(f, layer, e) {
          return thisApp.mapTooltipView({
            name: f.properties.Name,
            label: 'Score',
            value: mpFormatters.number(f.properties.originalScore, 0)
          });
        }
      ));

      // Score per population map
      this.maps.scorePerPop = {};
      this.maps.scorePerPop.scale = this.makeColorScale(function(f) {
        return f.properties.originalScore / f.properties.population;
      });
      _.extend(this.maps.scorePerPop, this.makeNeighborhoodMap(
        'map-score-per-capita', false, true,
        function(f, layer) {
          return _.extend({}, mpMaps.mapStyle, {
            fillOpacity: 0.75,
            fillColor: thisApp.maps.scorePerPop.scale(f.properties.originalScore / f.properties.population)
          });
        },
        function(f, layer, e) {
          return thisApp.mapTooltipView({
            name: f.properties.Name,
            label: 'Score per 1,000 residents',
            value: mpFormatters.number(f.properties.originalScore / f.properties.population * 1000, 2)
          });
        }
      ));
    },

    // Make a color scale for mapping
    makeColorScale: function(property) {
      var propertyF;

      if (!_.isFunction(property)) {
        propertyF = function(f) {
          return f.properties[property];
        };
      }
      else {
        propertyF = property;
      }

      var min = _.min(this.nData.features, propertyF);
      min = propertyF(min);

      var max = _.max(this.nData.features, propertyF);
      max = propertyF(max);

      return chroma.scale(['white', 'green']).out('hex').mode('lch')
        .domain([min, max], 5);
    },

    // Make a neighborhood map
    makeNeighborhoodMap: function(id, outliers, north, style, tooltip) {
      var map = {};
      var base;
      var data = (outliers) ? this.nDataOutliers : this.nData;

      // Make map
      map.map = new L.Map(id, mpMaps.mapOptions);
      base = new L.tileLayer('//{s}.tiles.mapbox.com/v3/' + mpMaps.mapboxStreetsLightLabels + '/{z}/{x}/{y}.png');
      map.map.addLayer(base);
      map.map.setView(mpMaps.minneapolisPoint, 8);
      map.map.removeControl(map.map.attributionControl);

      // Tool tip
      map.tooltipControl = new mpMaps.TooltipControl();
      map.map.addControl(map.tooltipControl);

      // Add geojson layer
      map.nLayer = L.geoJson(data, {
        style: style,
        onEachFeature: function(feature, layer) {
          layer.on('mouseover', function(e) {
            map.tooltipControl.update(tooltip(feature, layer, e));
          });
          layer.on('mouseout', function(e) {
            map.tooltipControl.hide();
          });
        }
      });
      map.nLayer.addTo(map.map);

      // Add north outline
      if (north) {
        L.geoJson(this.nNorth, {
          style: {
            fillColor: 'transparent',
            fillOpacity: 0,
            color: 'black',
            strokeWidth: 2.5,
            clickable: false
          }
        }).addTo(map.map);
      }

      // Geojson should have a callback, but it doesn't so we do this
      _.delay(function() {
        map.map.fitBounds(map.nLayer.getBounds());
        map.map.invalidateSize();
      }, 900);

      return map;
    },




    // Default options
    defaultOptions: {
      projectName: 'minnpost-transit-stops',
      remoteProxy: '//mp-jsonproxy.herokuapp.com/proxy?callback=?&url=',
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
            '//s3.amazonaws.com/data.minnpost/projects/minnpost-transit-stops/minnpost-transit-stops.libs.min.css',
            '//s3.amazonaws.com/data.minnpost/projects/minnpost-transit-stops/minnpost-transit-stops.latest.min.css'
          ],
          ie: [
            '//s3.amazonaws.com/data.minnpost/projects/minnpost-transit-stops/minnpost-transit-stops.libs.min.ie.css',
            '//s3.amazonaws.com/data.minnpost/projects/minnpost-transit-stops/minnpost-transit-stops.latest.min.ie.css'
          ],
          images: '//s3.amazonaws.com/data.minnpost/projects/minnpost-transit-stops/images/',
          data: '//s3.amazonaws.com/data.minnpost/projects/minnpost-transit-stops/data/'
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
