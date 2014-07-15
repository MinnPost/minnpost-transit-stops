/**
 * Processes stops into shapes and does some analysis.
 */

var fs = require('fs');
var path = require('path');
var _ = require('lodash');
var gu = require('geojson-utils');
var ga = require('geojson-area');
var csv = require('fast-csv');

var stops = require('../build/stops.geo.json')
var boardings = require('../build/boardings.json')
var mplsN = require('../build/minneapolis-neighborhoods.geo.json')
var demographics = require('../build/neighborhood-demographics.json');

var outputGeo = path.resolve(__dirname, '../build/neighborhood-stop-data.geo.json');
var outputCsv = path.resolve(__dirname, '../neighborhood-stop-data.csv');

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

// Get community areas into a sorted array, since SPSS wants categories
// as numbers
var community_areas = _.sortBy(_.uniq(_.filter(_.map(demographics, function(d, di) {
  return d.column3;
}), function(d, di) {
  return ([null, '', false, 'X', 'Community (Minneapolis geographies only)'].indexOf(d) === -1);
})));

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
    (p.sign * 1) +
    (p.bench * 2) +
    (p.light * 3) +
    (p.heat * 4) +
    (p.shelter * 5)
  );

  // Remove stops from data
  delete p.stops

  // Add in demographic data
  var found = false;
  _.each(demographics, function(d, di) {
    if (d.column2 && d.column5 === 'Minneapolis' && translateNeighborhood(d.column2) === p.neighbor_1) {
      found = true;
      p.community_area = d.column3;
      p.community_area_index = community_areas.indexOf(d.column3);
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

  /*
  p.score_by_emp = p.score / p.employed;
  p.score_by_jobs = p.score / p.jobs;

  p.score_no_count_by_pop = p.score_no_count / p.population;
  p.score_heavy_by_pop = p.score_heavy / p.population;

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
  */

  return f;
});

// Let's group the northern neighborhoods
mplsN.features = _.map(mplsN.features, function(f, fi) {
  f.properties.north = 0;
  if (['Near North', 'Camden'].indexOf(f.properties.community_area) !== -1) {
    f.properties.north = 1;
  }

  return f;
});

// Let's mark outliers
mplsN.features = _.map(mplsN.features, function(f, fi) {
  f.properties.outlier = 0;
  if (['Mid - City Industrial', 'Humboldt Industrial Area', 'Camden Industrial', 'Downtown West', 'Downtown East'].indexOf(f.properties.Name) !== -1) {
    f.properties.outlier = 1;
  }

  return f;
});


// Save output to geojson
fs.writeFile(outputGeo, JSON.stringify(mplsN), function(err) {
  if (err) {
    console.log('Issue writing file: ' + err);
  }
  else {
    console.log('GeoJSON file saved to: ' + outputGeo);
  }
});

// Save output to CSV.  For CSV output, we want to take out the outliers since
// it is easier to work with in SPSS/PSPP
mplsN.features = _.filter(mplsN.features, function(f, fi) {
  return (f.properties.outlier !== 1);
});
csv.writeToPath(outputCsv, _.map(mplsN.features, function(f, fi) {
  // For some awesome reasons, SPSS can't handle big floats
  _.each(f.properties, function(p, pi) {
    f.properties[pi] = _.isNumber(f.properties[pi]) ? f.properties[pi].toFixed(6) : f.properties[pi];
  });

  return f.properties;
}), { headers: true })
  .on('finish', function() {
    console.log('CSV file saved to: ' + outputCsv);
  });
