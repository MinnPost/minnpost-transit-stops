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
script_tracts := $(processing)/some-data-processing-script.js

# Sources
source_stops := ftp://gisftp.metc.state.mn.us/TransitStops.zip
source_boardings := ftp://gisftp.metc.state.mn.us/TransitStopsBoardingsAndAlightings.zip

# Local sources
local_stops_zip := $(original)/transit-stops.zip
local_stops_dir := $(original)/transit-stops/
local_stops := $(original)/transit-stops/TransitStops.shp
local_boardings_zip := $(original)/transit-boardings.zip
local_boardings_dir := $(original)/transit-boardings/
local_boardings := $(original)/transit-boardings/TransitStopsBoardingsAndAlightings.xlsx
local_shelters := $(original)/Shelter_database.xlsx

# Converted
build_stops := $(build)/stops.geo.json
build_boardings := $(build)/boardings.csv
build_shelters := $(build)/shelters.csv

# Final
stops := $(data)/stops.geo.json



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

download: $(local_stops) $(local_boardings)
clean_download:
	rm -rv $(local_stops_dir) $(local_stops_zip)
	rm -rv $(local_boardings_dir) $(local_boardings_zip)


# Convert and filter data files
$(build_boardings): $(local_boardings)
	mkdir -p $(build)
	in2csv $(local_boardings) --format=xlsx > $(build_boardings)

$(build_shelters): $(local_shelters)
	mkdir -p $(build)
	in2csv $(local_shelters) --format=xlsx > $(build_shelters)

$(build_stops): $(local_stops) $(build_boardings) $(build_shelters)
	mkdir -p $(build)
	ogr2ogr -f "GeoJSON" $(build_stops) $(local_stops) -overwrite -t_srs "EPSG:4326" \
		-sql "SELECT TransitStops.site_id AS id, TransitStops.site_on AS street, TransitStops.site_at AS at, TransitStops.publiccomm AS comments, TransitStops.dt_zone AS dt, TransitStops.bench AS bench, TransitStops.parkride AS parkride, TransitStops.sidewalk AS sidewalk, TransitStops.adaaccess AS ada_access, TransitStops.ada_comm AS ada_comments, TransitStops.sign AS sign, TransitStops.shelter AS shelter, TransitStops.hi_freq AS freq, shelters.PROP_DESC AS shelter_desc, shelters.OWNER AS owner, shelters.shel_type AS shelter_type, shelters.Light AS light, shelters.heat AS heat FROM TransitStops LEFT JOIN '$(build_shelters)'.shelters ON TransitStops.site_id = shelters.site_id WHERE TransitStops.busstop_yn = 'Y'"

convert: $(build_boardings) $(build_shelters) $(build_stops)
clean_convert:
	rm -rv $(build)/*


# Final
$(stops): $(build_stops)
	cp $(build_stops) $(stops)


# General
all: convert
clean: clean_download clean_convert



ogr2ogr -overwrite -sql "select TransitStops.*, stops.*, stops.Light AS light from TransitStops left join 'stops.csv'.stops on TransitStops.site_id = stops.site_id" T2/combine_stops.shp TransitStops/TransitStops.shp
