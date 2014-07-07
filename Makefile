###
# Make file for project.
#
# Downloads, filters, and converts data
#
###

# Directories
data := data
original := $(data)/original
build := $(data)/build
processing := $(data)/processing

# Scripts
script_tracts := $(processing)/stop-processing.js

# Sources
source_stops := ftp://gisftp.metc.state.mn.us/TransitStops.zip
source_boardings := ftp://gisftp.metc.state.mn.us/TransitStopsBoardingsAndAlightings.zip
source_mpls_n := https://communities.socrata.com/api/geospatial/7sug-nju9?method=export&format=Original
source_demo := http://www.mncompass.org/_data/neighborhood-profiles/mnc-2011-neighborhood-profiles-alldata-no-suppression-r2.zip

# Local sources
local_stops_zip := $(original)/transit-stops.zip
local_stops_dir := $(original)/transit-stops/
local_stops := $(original)/transit-stops/TransitStops.shp
local_boardings_zip := $(original)/transit-boardings.zip
local_boardings_dir := $(original)/transit-boardings/
local_boardings := $(original)/transit-boardings/TransitStopsBoardingsAndAlightings.xlsx
local_shelters := $(original)/Shelter_database.xlsx
local_mpls_n_zip := $(original)/minneapolis-neighborhoods-2013.zip
local_mpls_n_dir := $(original)/minneapolis-neighborhoods-2013/
local_mpls_n := $(original)/minneapolis-neighborhoods-2013/minneapolis-neighborhoods-2013.shp
local_demo_zip := $(original)/neighborhood_demographics.zip
local_demo_dir := $(original)/neighborhood_demographics/
local_demo := $(original)/neighborhood_demographics/MNC_2011_NeighborhoodProfiles_AllData_NoSuppressionR2.xlsx

# Converted
build_stops := $(build)/stops.geo.json
build_boardings := $(build)/boardings.json
build_shelters := $(build)/shelters.csv
build_mlps_n := $(build)/minneapolis-neighborhoods.geo.json
build_demo := $(build)/neighborhood-demographics.json
build_stops_n := $(build)/neighborhood-stop-data.geo.json

# Final
stops := $(data)/neighborhood-stop-data.topo.json



# Download and unzip sources.  Touch shapefile so that make knows it it
# up to date
$(local_stops):
	mkdir -p $(original)
	curl -o $(local_stops_zip) "$(source_stops)"
	unzip $(local_stops_zip) -d $(local_stops_dir)
	touch $(local_stops)

$(local_boardings):
	mkdir -p $(original)
	curl -o $(local_boardings_zip) "$(source_boardings)"
	unzip $(local_boardings_zip) -d $(local_boardings_dir)
	touch $(local_boardings)

$(local_mpls_n):
	mkdir -p $(original)
	curl -o $(local_mpls_n_zip) "$(source_mpls_n)"
	unzip $(local_mpls_n_zip) -d $(local_mpls_n_dir)
	touch $(local_mpls_n)

$(local_demo):
	mkdir -p $(original)
	curl -o $(local_demo_zip) "$(source_demo)"
	unzip $(local_demo_zip) -d $(local_demo_dir)
	touch $(local_demo)

download: $(local_stops) $(local_boardings) $(local_mpls_n) $(local_demo)
clean_download:
	rm -rv $(local_stops_dir) $(local_stops_zip)
	rm -rv $(local_boardings_dir) $(local_boardings_zip)
	rm -rv $(local_mpls_n_dir) $(local_mpls_n_zip)


# Convert and filter data files
$(build_boardings): $(local_boardings)
	mkdir -p $(build)
	in2csv $(local_boardings) --format=xlsx | csvjson > $(build_boardings)

$(build_shelters): $(local_shelters)
	mkdir -p $(build)
	in2csv $(local_shelters) --format=xlsx > $(build_shelters)

$(build_demo): $(local_demo)
	mkdir -p $(build)
	in2csv $(local_demo) --format=xlsx --no-header-row | csvcut --no-header-row -c 1,2,3,4,5,6,16,46,56,58,132,238,434 | csvjson > $(build_demo)

$(build_mlps_n): $(local_mpls_n)
	mkdir -p $(build)
	ogr2ogr -f "GeoJSON" $(build_mlps_n) $(local_mpls_n) -overwrite -t_srs "EPSG:4326"

$(build_stops): $(local_stops) $(build_shelters)
	mkdir -p $(build)
	ogr2ogr -f "GeoJSON" $(build_stops) $(local_stops) -overwrite -t_srs "EPSG:4326" \
		-sql "SELECT TransitStops.site_id AS id, TransitStops.site_on AS street, TransitStops.site_at AS at, TransitStops.publiccomm AS comments, TransitStops.dt_zone AS dt, TransitStops.bench AS bench, TransitStops.parkride AS parkride, TransitStops.sidewalk AS sidewalk, TransitStops.adaaccess AS ada_access, TransitStops.ada_comm AS ada_comments, TransitStops.sign AS sign, TransitStops.shelter AS shelter, TransitStops.hi_freq AS freq, shelters.PROP_DESC AS shelter_desc, shelters.OWNER AS owner, shelters.shel_type AS shelter_type, shelters.Light AS light, shelters.heat AS heat FROM TransitStops LEFT JOIN '$(build_shelters)'.shelters ON TransitStops.site_id = shelters.site_id WHERE TransitStops.busstop_yn = 'Y'"

$(build_stops_n): $(build_boardings) $(build_shelters) $(build_demo) $(build_mlps_n) $(build_stops)
	node $(script_tracts)

$(stops): $(build_stops_n)
	topojson $(build_stops_n) --id-property="id" -p -o $(stops)

convert: $(stops)
clean_convert:
	rm -rv $(build)/*
	rm $(stops)



# General
all: convert
clean: clean_download clean_convert
