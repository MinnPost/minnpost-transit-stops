
/**
 * Helpers functions such as formatters or extensions
 * to libraries.
 */
define('helpers', ['jquery', 'underscore'],
  function($, _) {

  var helpers = {};

  /**
   * Override Backbone's ajax call to use JSONP by default as well
   * as force a specific callback to ensure that server side
   * caching is effective.
   */
  helpers.overrideBackboneAJAX = function() {
    Backbone.ajax = function() {
      var options = arguments;

      if (options[0].dataTypeForce !== true) {
        options[0].dataType = 'jsonp';
        options[0].jsonpCallback = 'mpServerSideCachingHelper' +
          _.hash(options[0].url);
      }
      return Backbone.$.ajax.apply(Backbone.$, options);
    };
  };

  /**
   * Returns version of MSIE.
   */
  helpers.isMSIE = function() {
    var match = /(msie) ([\w.]+)/i.exec(navigator.userAgent);
    return match ? parseInt(match[2], 10) : false;
  };

  /**
   * Wrapper for a JSONP request, the first set of options are for
   * the AJAX request, while the other are from the application.
   */
  helpers.jsonpRequest = function(requestOptions, appOptions) {
    options.dataType = 'jsonp';
    options.jsonpCallback = 'mpServerSideCachingHelper' +
      _.hash(options.url);

    if (appOptions.remoteProxy) {
      options.url = options.url + '&callback=mpServerSideCachingHelper';
      options.url = appOptions.remoteProxy + encodeURIComponent(options.url);
      options.cache = true;
    }

    return $.ajax.apply($, [options]);
  };

  /**
   * Data source handling.  For development, we can call
   * the data directly from the JSON file, but for production
   * we want to proxy for JSONP.
   *
   * `name` should be relative path to dataset
   * `options` are app options
   *
   * Returns jQuery's defferred object.
   */
  helpers.getLocalData = function(name, options) {
    var useJSONP = false;
    var defers = [];
    name = (_.isArray(name)) ? name : [ name ];

    // If the data path is not relative, then use JSONP
    if (options && options.paths && options.paths.data.indexOf('http') === 0) {
      useJSONP = true;
    }

    // Go through each file and add to defers
    _.each(name, function(d) {
      var defer;

      if (useJSONP) {
        defer = helpers.jsonpRequest({
          url: proxyPrefix + encodeURI(options.paths.data + d)
        }, options);
      }
      else {
        defer = $.getJSON(options.paths.data + d);
      }
      defers.push(defer);
    });

    return $.when.apply($, defers);
  };

  /**
   * Reads query string and turns into object.
   */
  helpers.parseQueryString = function() {
    var assoc  = {};
    var decode = function(s) {
      return decodeURIComponent(s.replace(/\+/g, " "));
    };
    var queryString = location.search.substring(1);
    var keyValues = queryString.split('&');

    _.each(keyValues, function(v, vi) {
      var key = v.split('=');
      if (key.length > 1) {
        assoc[decode(key[0])] = decode(key[1]);
      }
    });

    return assoc;
  };

  return helpers;
});


define('text!templates/application.mustache',[],function () { return '<div class="application-container">\n  <div class="message-container"></div>\n\n  <div class="content-container">\n\n    <div class="row">\n      <div class="column-medium-50">\n        <p>Recently, there has been talk about transit stop quality in Minneapolis, specifically how the Northern neighborhoods might have less amenities than other neighborhoods.  So, how do we determine or quanitify stop quality across the city?</p>\n\n        <p>First we need some data.  Fortunately, there is a lot of public, online data for us to start with.  We first grabbed basic stop data for all MetroTransit stops; this included data such as location and some basic amenities like benches and shelters.  MetroTransit also provides boarding data for a number of the stops online.  We had to make a specific request to MetroTransit for data on shelter amentities such as heating and lighting.  And finally, we were able to get recent demographic data for Minneapolis neighborhoods from MN Compass.</p>\n      </div>\n      <div class="column-medium-50">\n\n      </div>\n    </div>\n\n    <div class="row">\n      <div class="column-medium-50">\n        <p>There are 87 neighborhoods in Minneapolis.  So, which ones are we talking about when we say North Minneapolis?  Well, the answer can change on who you are talking to, but we are defining them as the Minneapolis Community Areas known as Camden and Near North.</p>\n      </div>\n      <div class="column-medium-50">\n        <div class="map" id="map-neighborhoods-north"></div>\n      </div>\n    </div>\n\n\n    <div class="row">\n      <div class="column-medium-50">\n        <p>Now that we have intendified our comparison area, we want to make start to make sure that are comparisons are on equal grounds.  First we remove two groups of neighborhoods.  The industrial neighborhoods that have none or very low populations.</p>\n        <p>The second is a bit more subjective.  The layout of the transit system is a hub-spoke layout, meaning that most of the routes end up terminating or going through the hub, which is Downtown in the instance.  So, we remove these as they will end up skewing any comparison we do.</p>\n      </div>\n      <div class="column-medium-50">\n        <div class="map" id="map-neighborhoods-outliers"></div>\n      </div>\n    </div>\n\n\n    <div class="row">\n      <div class="column-medium-50">\n        <p>Next we can start to look at stop quality.  If we look at just the number of shelters per neighborhood, there is an pretty obvious visual pattern that shows more shelters in the South/West of the city.</p>\n      </div>\n      <div class="column-medium-50">\n        <div class="map" id="map-shelters"></div>\n      </div>\n    </div>\n\n\n    <div class="row">\n      <div class="column-medium-50">\n        <p>But we want to consider other amenities such as heating, lighting, benches, and signs.  So, let\'s create a stop score based on these factors.  Of course, this is fairly subjective, and we will explore what it means to change the scoring below.</p>\n\n        <p>\n          Has a shelter: 5 points <br />\n          Has a heater: 4 points <br />\n          Has lighting: 3 points <br />\n          Has a bench: 2 points <br />\n          Has a sign: 1 points\n        </p>\n      </div>\n      <div class="column-medium-50">\n        <div class="map" id="map-scores"></div>\n      </div>\n    </div>\n\n\n    <div class="row">\n      <div class="column-medium-50">\n        <p>We now have a decent measure of stop quality, but we still haven\'t taken into account that each neighborhood is unique.  Each neighborhood is unique in many ways, but  we need to at the very least adjust for population.  This means we want to look at stop quality per capita for each neightborhood.  Once we do this, it becomes much harder to tell visually if there are specific areas of the city that do or do not have a significant stop qaulity difference.</p>\n      </div>\n      <div class="column-medium-50">\n        <div class="map" id="map-score-per-capita"></div>\n      </div>\n    </div>\n\n\n    <div class="row">\n      <div class="column-medium-50">\n        <p>Our final step is to run these numbers through some statistical analysis.  We want to compare the northern neighborhoods to the rest of the neighborhoods which means that <a href="http://en.wikipedia.org/wiki/ANOVA" target="_blank">ANOVA</a> (analysis of variance) is most appropriate.  ANOVA is a model that tells us if the average of the groups are the same, statistically speaking.</p>\n\n        <p>\n          All neighborhoods:  {{ formatters.number(meanAll * 1000, 2) }} score per 1,000 residents<br >\n          Northern neighborhoods: {{ formatters.number(meanNorth * 1000, 2) }}<br>\n          Non-Northern neighborhoods: {{ formatters.number(meanNonNorth * 1000, 2) }}\n        </p>\n\n        <p>We know that the averages are indeed different.  But given the all the values and how each neighborhood differs from the next, we need something more soffisticated to ask is this different really our of the norm given the city as a whole.</p>\n      </div>\n      <div class="column-medium-50">\n        <div class="xxlarge text-center">\n          .201 : Not significant\n        </div>\n\n        <p><br><br></p>\n        <p>This means that we can\'t say with certianty that the values are significantly different.</p>\n      </div>\n    </div>\n\n\n    <div class="row">\n      <div class="column-medium-50">\n        <p>This analysis does not conclude that we shouldn\'t look deeper or that the northern neighborhoods don\'t need better stop quality, it simply means that by just looking at the numbers, we can\'t be certain that the northern neighborhoods have significantly lower stop quality.</p>\n      </div>\n      <div class="column-medium-50">\n      </div>\n    </div>\n\n\n    <div class="row">\n      <div class="column-medium-50">\n        <p>And of course, our methodolgy may not be perfect; maybe there are things we can adjust that moer accurately describes how you view the situation.  For instance, adjust how our score is calculated or how we want to normalize each neighborhood.</p>\n\n        <p><em>Insert sliders and knobs here to play with anaylsis.</em></p>\n      </div>\n      <div class="column-medium-50">\n        <div class="xxlarge text-center">\n          Maybe significant\n        </div>\n      </div>\n    </div>\n\n\n    <div class="row">\n      <div class="column-medium-50">\n        <p>Originally, the claims were that the northern neighborhoods did not have the same stop quality as the rest of the city, and our analysis above shows that its very difficult to be certain of this.  But, we can still look at other numbers to see if there are indeed neighborhoods that are lacking in stop quality.</p>\n\n        <p>The scatterplot to the right shows the score per capita against the percentage of the non-white population in each neighborhood.  We can see pretty easily that there is not really any correlation between these two variables.</p>\n      </div>\n      <div class="column-medium-50">\n        <div class="chart" id="chart-score-non-white"></div>\n      </div>\n    </div>\n\n\n    <div class="row">\n      <div class="column-medium-50">\n        <p>We could also look at score per 1,000 residents against percenage employed.  Again, we don\'t see any real correlation.</p>\n      </div>\n      <div class="column-medium-50">\n        <div class="chart" id="chart-score-employed"></div>\n      </div>\n    </div>\n\n\n  </div>\n\n  <div class="footnote-container">\n    <div class="footnote">\n      <p>Some code, techniques, and data on <a href="https://github.com/minnpost/minnpost-transit-stops" target="_blank">Github</a>.</p>\n\n        <p>Some map data © OpenStreetMap contributors; licensed under the <a href="http://www.openstreetmap.org/copyright" target="_blank">Open Data Commons Open Database License</a>.  Some map design © MapBox; licensed according to the <a href="http://mapbox.com/tos/" target="_blank">MapBox Terms of Service</a>.  Location geocoding provided by <a href="http://www.mapquest.com/" target="_blank">Mapquest</a> and is not guaranteed to be accurate.</p>\n\n    </div>\n  </div>\n</div>\n';});


define('text!templates/map-tooltip.underscore',[],function () { return '<div class="general-map-tooltip">\n  <strong><%= name %></strong>\n\n  <% if (typeof label != \'undefined\' && label) { %>\n    <br />\n    <%= label %>: <%= value %>\n  <% } %>\n</div>\n';});

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

      $.getJSON('data/neighborhood-stop-data.topo.json', function(data) {
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
      this.charts = {};

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

