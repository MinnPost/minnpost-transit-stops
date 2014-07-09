/**
 * RequireJS config which maps out where files are and shims
 * any non-compliant libraries.
 */
require.config({
  shim: {
    'simple-statistics': {
      exports: 'ss'
    },
    'highcharts': {
      exports: 'Highcharts'
    }
  },
  baseUrl: 'js',
  paths: {
    'requirejs': '../bower_components/requirejs/require',
    'almond': '../bower_components/almond/almond',
    'text': '../bower_components/text/text',
    'jquery': '../bower_components/jquery/dist/jquery',
    'underscore': '../bower_components/underscore/underscore',
    'ractive': '../bower_components/ractive/ractive',
    'ractive-events-tap': '../bower_components/ractive-events-tap/ractive-events-tap',
    'leaflet': '../bower_components/leaflet/dist/leaflet-src',
    'topojson': '../bower_components/topojson/topojson',
    'chroma': '../bower_components/chroma-js/chroma',
    'highcharts': '../bower_components/highcharts/highcharts',
    'simple-statistics': '../bower_components/simple-statistics/src/simple_statistics',
    'mpConfig': '../bower_components/minnpost-styles/dist/minnpost-styles.config',
    'mpHighcharts': '../bower_components/minnpost-styles/dist/minnpost-styles.highcharts',
    'mpFormatters': '../bower_components/minnpost-styles/dist/minnpost-styles.formatters',
    'mpMaps': '../bower_components/minnpost-styles/dist/minnpost-styles.maps',
    'minnpost-transit-stops': 'app'
  }
});
