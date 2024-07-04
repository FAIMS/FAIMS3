(intro/mapping)=
# Mapping

Get to know how geospatial data is captured and used in Fieldmark

## Data Capture

Fieldmark can capture geospatial data in two ways:

1. A single point
2. A bounding box drawn on a map

Data are stored in [geojson](https://geojson.org/) format, and can be expressed as longitude and latitude.

### Take point from GPS

:::{warning}
We have observed that devices require the internet to get geospatial fixes when using internal on-device GPS. Make sure that you are able to see a blue dot in Google Maps in your nearby area before starting fieldwork. If your fieldwork area is significant travel from your basecamp, use an external GPS. We recommend a [Bad Elf](https://bad-elf.com/pages/be-gps-3300-detail). 
:::

Pushing this button creates the following GeoJSON:
```
{"type": "Feature", 
"geometry": {
    "type": "Point", 
    "coordinates": [151.10000, -33.70000]
    }, 
"properties": {
    "timestamp": 1680059518444, 
    "altitude": null, 
    "speed": null, 
    "heading": null, 
    "accuracy": 1050.9526569977945, 
    "altitude_accuracy": null, 
    "title": "-00001"
    }, 
"id": "-00001", 
"record_id": "rec-d7269822-22e8-4218-8681-86b34f902ab2"}
```

Make sure to test your devices and sensors. Ensure that you emulate the network connectivity *and travel distance* of your basecamp to research sites when testing. Network conditions will impact device GPS use.


### Device limitations

Fieldmark collects the geospatial data captured by the device and will be as accurate as that device allows. While most tablets offer sufficient accuracy in online settings, many have error ranges of 20m or more which may not be satisfactory for many projects.

We recommend using an external Bluetooth device.
     
## Basemaps

By default, Fieldmark will display a base map sourced from [OpenStreetMap](https://www.openstreetmap.org/) for any map field. (You must connect to the internet before going offline to see the map.)

Functionality to display custom geotiffs is currently in beta testing.  

## Export

Geospatial data will be exported in .kml and .geojson formats.
