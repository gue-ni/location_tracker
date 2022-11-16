const express = require('express')
const morgan = require('morgan')
const fs = require('fs');

const app = express()

const port = 8002
const filename = 'db/locations.json';

app.use(express.json());
app.use(morgan('combined'));

app.get('*', (req, res) => {
    res.json([]);
})

app.post('*', (req, res) => {
    const data = req.body;
    let locations = [];

    if (data){
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

    res.json([]);
})

app.listen(port, () => {
    console.log(`Location Tracker app listening on port ${port}`)
});


