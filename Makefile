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
local_shelters := data/original/Shelter_database.xlsx

# Converted
build_stops := $(build)/stops.geo.json

# Final
stops := $(data)/stops.geo.json



# Download and unzip sources.  Touch shapefile so that make knows it it
# up to date
$(local_stops_shp):
	mkdir -p $(original)
	curl -o $(local_stops_zip) "$(source_stops)"
	unzip $(local_stops_zip) -d $(local_stops_dir)
	touch $(local_stops_shp)

$(local_boardings):
	mkdir -p $(original)
	curl -o $(local_boardings_zip) "$(source_boardings)"
	unzip $(local_boardings_zip) -d $(local_boardings_dir)
	touch $(local_boardings)

download: $(local_stops_shp) $(local_boardings_xls)
clean_download:
	rm -rv $(local_stops_dir) $(local_stops_zip)
	rm -rv $(local_boardings_dir) $(local_boardings_zip)


# Convert and filter data files
$()

$(example): $(local_example_shp)
	mkdir -p $(build)
	ogr2ogr -f "GeoJSON" $(build_example) $(local_example_shp) -overwrite -where "NAME = 'Southwest LRT'" -t_srs "EPSG:4326"
	cp $(build_example) $(example)

convert: $(example)
clean_convert:
	rm -rv $(build)/*
	rm -rv $(example)


# General
all: convert
clean: clean_download clean_convert



ogr2ogr -overwrite -sql "select TransitStops.*, stops.*, stops.Light AS light from TransitStops left join 'stops.csv'.stops on TransitStops.site_id = stops.site_id" T2/combine_stops.shp TransitStops/TransitStops.shp
