const express = require('express')
const morgan = require('morgan')
const sqlite3 = require('sqlite3')

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
app.use(express.static('public/heatmap'));

function all(sql, params) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      resolve(rows);
    });
  });
}

function get(sql, params) {
  return new Promise((resolve, reject) => {
    db.get(sql, (err, row) => {
      if (err) reject(err);
      resolve(row);
    });
  });
}

function run(sql, params) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, (err) => {
      if (err) reject(err);
      resolve();
    });
  });
}

function getCoordinates() {
  return all("SELECT lat, lon, DATETIME(tst, 'auto') AS dt, tid FROM locations");
}

function getLastCoordinates() {
  return get(`
    SELECT lat, lon, tst, DATETIME(tst, 'auto') AS dt 
    FROM locations 
    ORDER BY tst DESC LIMIT 1
  `);
}

function writeLocation(lat, lon, tst, tid) {
  const sql = "INSERT INTO locations (lat, lon, tst, tid) VALUES (?, ?, ?, ?)";
  return run(sql, [lat, lon, tst, tid]);
}

function googleMaps(lat, lon, zoom) {
  // http://maps.google.com/?q=${lat},${lon}&t=h&z=${zoom}
  return `https://www.google.com/maps/place/${lat},${lon}/@${lat},${lon},${zoom}z`;
}

// Redirect to last known location on google maps.
app.get('/latest', async (req, res, next) => {
  try {
    const latest = await getLastCoordinates();
    if (latest) {
      return res.redirect(googleMaps(latest.lat, latest.lon, 15));
    } else {
      return res.status(400).send();
    }
  } catch (err) {
    next(err);
  }
});

// Returns location data. Timestamp removed and randomized for privacy. 
app.get('/locations', async (req, res, next) => {
  try {
    const locations = await all("SELECT lat, lon FROM locations ORDER BY RANDOM()");
    return res.json(locations);
  } catch (err) {
    next(err);
  }
})

// Returns status.
app.get('/status', async (req, res, next) => {
  try {
    const { count } = await get('SELECT COUNT(*) AS count FROM locations');
    const latest_coordinates = await getLastCoordinates();
    return res.status(200).json({ count, latest_coordinates });
  } catch(err) {
    next(err);
  }
})

// Save location data in database.
app.post('*', async (req, res, next) => {
  try {
    const data = req.body;

    if (data && data._type === "location") {
      const { lat, lon, tst, tid } = data;
      await writeLocation(lat, lon, tst, tid);
    }
    // Owntracks expects an empty json array as reponse.
    return res.status(200).json([]);
  } catch (err) {
    // Owntracks sometimes repeats messages. Already saved timestamp/location tuples shall be ignored.
    if (err.code == "SQLITE_CONSTRAINT") {
      console.error(err.code);
      return res.status(200).json([]);
    } else {
      return next(err);
    }
  }
})

const errorHandler = (err, req, res, next) => {
  const errStatus = err.statusCode || 500;
  console.error(err)
  return res.status(errStatus).json([])
}

app.use(errorHandler);

app.listen(port, () => {
  console.log(`Location Tracker listening on port ${port}`)
});


