const express = require('express')
const morgan = require('morgan')
const fs = require('fs');
const sqlite3 = require('sqlite3')


const app = express()

const port = 8002;

const db = new sqlite3.Database('db/locations.db');
db.serialize(() => {
  const sql = `
  CREATE TABLE IF NOT EXISTS locations 
  (
    id INTEGER PRIMARY KEY, 
    tid TEXT,
    lat INTEGER,
    lon INTEGER,
    tst INTEGER
  )`;

  db.run(sql);
});

app.use(express.json());
app.use(morgan('combined'));

function get_all_from_db() {
  const sql = "SELECT lat, lon, tst, tid FROM locations";
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
  }) ;
}

app.get('/latest', async (req, res) => {
  let locations = await get_all_from_db();

  if (locations.length > 0){
    const latest = locations[locations.length - 1];
    let zoom = 13;
    let url = `https://www.google.com/maps/place/${latest.lat},${latest.lon}/@${latest.lat},${latest.lon},${zoom}z`;
    res.redirect(url);
  } else {
    res.status(404).send();
  }
});

app.get('*', async (req, res) => {
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
  console.log(`Location Tracker app listening on port ${port}`)
});


