const express = require('express')
const morgan = require('morgan')
const fs = require('fs');

const app = express()

const port = 8002
const filename = 'db/locations.json';

app.use(express.json());
app.use(morgan('combined'));

function get_latest(){
    let latest = null;
    try {
        const file = fs.readFileSync(filename);
        let locations = JSON.parse(file);
        latest = locations[locations.length - 1]
      } catch(e) {
        console.log(e);
      }
    return latest;
}

function write_location(data){
    if (data){
      let locations = [];

      try {
        const file = fs.readFileSync(filename);
        locations = JSON.parse(file);
      } catch(e) {
        console.log(e);
      }

      locations.push(data);

      try {
        fs.writeFileSync(filename, JSON.stringify(locations));
      }  catch(e) {
        console.log(e);
      }
    }
}

app.get('/latest', (req, res) => {
    let latest = get_latest();
    if (latest){
         let zoom = 13;
    let url = `https://www.google.com/maps/place/${latest.lat},${latest.lon}/@${latest.lat},${latest.lon},${zoom}z`;
    res.redirect(url);
    } else {
        res.status(404).send();
    }
   
});

app.get('*', (req, res) => {
    res.json([]);
})

app.post('*', (req, res) => {
    const data = req.body;

    write_location(data);

    res.json([]);
})

app.listen(port, () => {
    console.log(`Location Tracker app listening on port ${port}`)
});


