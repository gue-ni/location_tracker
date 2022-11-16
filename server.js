const express = require('express')
const morgan = require('morgan')
const fs = require('fs');

const app = express()

const port = 8002
const filename = 'db/locations.json';

app.use(express.json());
app.use(morgan('combined'));

function get_all_locations(){
  try {
    const file = fs.readFileSync(filename);
    return JSON.parse(file);
  } catch(e) {
    console.log(e);
    return [];
  }
}

function write_location(data){
  if (!data) {
    return;
  }

  let locations = get_all_locations();
  locations.push(data);

  try {
    fs.writeFileSync(filename, JSON.stringify(locations));
  }  catch(e) {
    console.log(e);
  }
}

function google_maps(lat, lon, zoom){
  // http://maps.google.com/?q=${lat},${lon}&t=h&z=${zoom}
  return `https://www.google.com/maps/place/${lat},${lon}/@${lat},${lon},${zoom}z`; 
}

app.get('/latest', (req, res) => {
  let locations = get_all_locations();

  if (locations.length > 0) {
    const { lat, lon } = locations[locations.length - 1];
    res.redirect(google_maps(lat, lon, 13);
  } else {
    res.status(404).send();
  }
});

app.get('*', (req, res) => {
    res.json(get_all_locations());
})

app.post('*', (req, res) => {
  const data = req.body;
  write_location(data);
  res.json([]);
})

app.listen(port, () => {
  console.log(`Location Tracker listening on port ${port}`)
});


