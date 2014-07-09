/**
 * Processes stops into shapes and does some analysis.
 */

var fs = require('fs');
var path = require('path');
var _ = require('lodash');
var gu = require('geojson-utils');
var ga = require('geojson-area');

var stops = require('../build/stops.geo.json')
var boardings = require('../build/boardings.json')
var mplsN = require('../build/minneapolis-neighborhoods.geo.json')
var demographics = require('../build/neighborhood-demographics.json');

var output = path.resolve(__dirname, '../build/neighborhood-stop-data.geo.json');

// Translation of demographic neighborhood name to our neighborhood id
function translateNeighborhood(name) {
  var id = name;
  var translations = {
    'cedar_riverside_west_bank': 'cedar_riverside',
    'prospect_park_east_river_road': 'prospect_park_east_river',
    'u_of_mn': 'university_of_minnesota',
    'jordon': 'jordan',
    'stevens_square_loring_hgts_': 'stevens_square_loring_heights',
    'northrup': 'northrop',
    'mid_city_ind_area': 'mid_city_industrial',
    'nicollet_island': 'nicollet_island_east_bank',
    'humboldt_industrial': 'humboldt_industrial_area'
  };

  id = id.toLowerCase().trim().replace(/[^\w ]+/g,'').replace(/ +/g,'_').replace(/[^\w-]+/g,'');
  // Manual translation
  if (translations[id]) {
    id = translations[id];
  }

  return id;
}

// Ouput message
console.log('Combining stop data into neighborhoods...');

// Group boardings for easier lookup
boardings = _.groupBy(boardings, 'Site_id');

// Combine boarding data to stop data
stops.features = _.map(stops.features, function(f, fi) {
  var id = f.properties.id;

  if (boardings[id]) {
    // Scheduled trips
    f.properties.trips = _.reduce(boardings[id], function(memo, b, bi) {
      return (memo + parseInt(b.Trips, 10));
    }, 0);
    // Observed trips for data
    f.properties.tripsO = _.reduce(boardings[id], function(memo, b, bi) {
      return (memo + parseInt(b.Trips_Obs, 10));
    }, 0);
    // Ons and offs
    f.properties.ons = _.reduce(boardings[id], function(memo, b, bi) {
      return (memo + parseFloat(b.Ons));
    }, 0);
    f.properties.offs = _.reduce(boardings[id], function(memo, b, bi) {
      return (memo + parseFloat(b.Offs));
    }, 0);
  }

  return f;
});

// Fix the fact that the shelter data does not have light rail stops.  There is
// not very consistent data to determine that it is a light rail stop.
stops.features = _.map(stops.features, function(f, fi) {
  if (((f.properties.id >= 51405 && f.properties.id <= 51437)||
    (f.properties.id >= 55994 && f.properties.id <= 56043)) &&
    (f.properties.at.toLowerCase().indexOf('platform') === 0)) {
    f.properties.heat = 'Yes';
    f.properties.light = 'Yes';
  }

  return f;
});


// Aggregate into polygons
mplsN.features = _.map(mplsN.features, function(f, fi) {
  var p = f.properties

  // Get area
  p.area_m = ga.geometry(f.geometry);
  p.area_km = p.area_m / 1000 / 1000;

  // Look at each stop and determine if in polygon
  _.each(stops.features, function(s, si) {
    if (gu.pointInPolygon(s.geometry, f.geometry)) {
      p.stops = p.stops || [];
      p.stops.push(s);
    }
  });

  // Reduce data into polygons
  p.s_count = p.stops.length;
  p.heat = _.reduce(p.stops, function(memo, s, si) {
    return (s.properties.heat == 'Yes') ? memo + 1 : memo;
  }, 0);
  p.shelter = _.reduce(p.stops, function(memo, s, si) {
    return (s.properties.shelter == 'Y') ? memo + 1 : memo;
  }, 0);
  p.light = _.reduce(p.stops, function(memo, s, si) {
    return (s.properties.light == 'Yes') ? memo + 1 : memo;
  }, 0);
  p.bench = _.reduce(p.stops, function(memo, s, si) {
    return (s.properties.bench) ? memo + 1 : memo;
  }, 0);
  p.sign = _.reduce(p.stops, function(memo, s, si) {
    return (s.properties.sign == 'Y') ? memo + 1 : memo;
  }, 0);
  p.trips = _.reduce(p.stops, function(memo, s, si) {
    return (s.properties.trips) ? memo + s.properties.trips : memo;
  }, 0);
  p.tripsO = _.reduce(p.stops, function(memo, s, si) {
    return (s.properties.tripsO) ? memo + s.properties.tripsO : memo;
  }, 0);
  p.ons = _.reduce(p.stops, function(memo, s, si) {
    return (s.properties.ons) ? memo + s.properties.ons : memo;
  }, 0);
  p.offs = _.reduce(p.stops, function(memo, s, si) {
    return (s.properties.offs) ? memo + s.properties.offs : memo;
  }, 0);

  // Make overall stop scores
  p.score = (
    (p.s_count * 0.25) +
    (p.sign * 1) +
    (p.bench * 1) +
    (p.shelter * 2) +
    (p.light * 3) +
    (p.heat * 4)
  );
  p.score_no_count = (
    (p.bench * 1) +
    (p.shelter * 2) +
    (p.light * 3) +
    (p.heat * 4)
  );
  p.score_heavy = (
    (p.bench * 1) +
    (p.shelter * 5) +
    (p.light * 10) +
    (p.heat * 20)
  );

  // Remove stops from data
  delete p.stops

  // Add in demographic data
  var found = false;
  _.each(demographics, function(d, di) {
    if (d.column2 && d.column5 === 'Minneapolis' && translateNeighborhood(d.column2) === p.neighbor_1) {
      found = true;
      p.community_area = d.column3;
      p.population = parseInt(d.column6, 10);
      p.employed = parseInt(d.column238, 10);
      p.employed_per = p.employed / p.population;
      p.jobs = parseInt(d.column434, 10);
      p.non_white_per = 1 - parseFloat(d.column16);
    }
  });
  if (!found) {
    console.log('Could not find neighborhood demo match for: ');
    console.log(p);
  }

  // Adjust for demographics
  p.score_by_pop = p.score / p.population;
  p.score_by_emp = p.score / p.employed;
  p.score_by_jobs = p.score / p.jobs;

  // Adjust for ridership
  p.score_by_trips = p.score / p.trips;
  p.score_by_ons = p.score / p.ons;
  p.score_by_offs = p.score / p.offs;
  p.score_by_ons_offs = p.score / (p.offs + p.ons);

  // Adjust for area
  p.score_by_area = p.score / p.area_km;
  p.score_by_pop_area = p.score / p.population / p.area_km;
  p.score_no_count_by_pop_area = p.score_no_count / p.population / p.area_km;
  p.score_heavy_by_pop_area = p.score_heavy / p.population / p.area_km;
  p.shelter_by_pop_area = p.shelter / p.population / p.area_km;
  p.light_by_pop_area = p.light / p.population / p.area_km;
  p.heat_by_pop_area = p.heat / p.population / p.area_km;

  return f;
});

// Just some test output
/*
var testProp = 'score_by_area';
mplsN.features = _.sortBy(mplsN.features, function(f, fi) {
  return f.properties[testProp];
});
_.each(mplsN.features, function(f, fi) {
  console.log(f.properties.Name + ': '  + f.properties[testProp]);
});
*/

// Save output
fs.writeFile(output, JSON.stringify(mplsN), function(err) {
  if (err) {
    console.log('Issue writing file: ' + err);
  }
  else {
    console.log('GeoJSON file saved to: ' + output);
  }
});
