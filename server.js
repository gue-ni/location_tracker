const express = require('express')
const morgan = require('morgan')
const sqlite3 = require('sqlite3')
const path = require('path');

const app = express()

const port = 8002;

const db = new sqlite3.Database('db/locations.db');
db.serialize(() => {
  const sql = `
  CREATE TABLE IF NOT EXISTS locations 
  (
    id INTEGER PRIMARY KEY, 
    tid TEXT NOT NULL,                -- tracker id
    lat REAL NOT NULL,                -- latitude
    lon REAL NOT NULL,                -- longitude
    tst INTEGER NOT NULL UNIQUE       -- timestamp
  )`;

  db.run(sql);
});

app.use(express.json());
app.use(morgan('combined'));
app.use(express.static('public'))

function get_all_from_db() {
  const sql = "SELECT lat, lon, DATETIME(tst, 'auto') AS dt, tid FROM locations";
  return new Promise((resolve, reject) => {
    db.all(sql, (err, rows) => {
      if (err) reject(err)
      resolve(rows);
    })
  });
}

function write_to_db(lat, lon, tst, tid) {
  const sql = "INSERT INTO locations (lat, lon, tst, tid) VALUES (?, ?, ?, ?)";
  return new Promise((resolve, reject) => {
    db.run(sql, [lat, lon, tst, tid], (err) => {
      if (err) reject(err);
      resolve();
    });
  });
}

function google_maps(lat, lon, zoom) {
  // http://maps.google.com/?q=${lat},${lon}&t=h&z=${zoom}
  return `https://www.google.com/maps/place/${lat},${lon}/@${lat},${lon},${zoom}z`;
}

app.get('/latest', async (req, res) => {
  let locations = await get_all_from_db();

  if (locations.length > 0) {
    const { lat, lon } = locations[locations.length - 1];
    res.redirect(google_maps(lat, lon, 13));
  } else {
    res.status(404).send();
  }
});

app.get('/locations', async (req, res) => {
  let locations = await get_all_from_db();
  res.json(locations);
})

app.post('*', async (req, res) => {
  const data = req.body;

  try {
    if (data && data._type == "location") {
      let { lat, lon, tst, tid } = data;
      await write_to_db(lat, lon, tst, tid);
    }
  } catch (e) {
    console.log(e);
  }

  res.json([]);
})

app.listen(port, () => {
  console.log(`Location Tracker listening on port ${port}`)
});


