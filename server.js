const express = require('express')
const morgan = require('morgan')
const sqlite3 = require('sqlite3').verbose();
const nunjucks = require('nunjucks');
const fs = require('fs')
const { loadImage, createCanvas, createPNGStream, Image, fillRect } = require('canvas')


const app = express()

nunjucks.configure('views', {
  autoescape: true,
  express: app
})

app.set('views', __dirname + '/views');
app.set('view engine', 'njk')

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
app.use(express.static('public'));

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
    db.get(sql, params, (err, row) => {
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

function degreesToRadians(degrees) {
  return (degrees * Math.PI) / 180;
}


// Distance between two points in meters
// https://www.geeksforgeeks.org/program-distance-two-points-earth/
function distanceBetweenPoints(lat1, lon1, lat2, lon2) {
  lon1 = degreesToRadians(lon1);
  lon2 = degreesToRadians(lon2);
  lat1 = degreesToRadians(lat1);
  lat2 = degreesToRadians(lat2);

  // Haversine formula
  let dlon = lon2 - lon1;
  let dlat = lat2 - lat1;
  let a = Math.pow(Math.sin(dlat / 2), 2)
    + Math.cos(lat1) * Math.cos(lat2)
    * Math.pow(Math.sin(dlon / 2), 2);

  let c = 2 * Math.asin(Math.sqrt(a));

  // Radius of earth in kilometers
  let radiusKilometers = 6371;
  let radiusMeters = radiusKilometers * 1000;

  return (c * radiusMeters); // distance in meters
}

app.get('/test', async (req, res, next) => {
  try {
    const locations = await all("SELECT tst, lat, lon FROM locations LIMIT 2");


    /*
    let lat1 = 53.32055555555556;
    let lat2 = 53.31861111111111;
    let lon1 = -1.7297222222222221;
    let lon2 = -1.6997222222222223;
    let distance = distanceBetweenPoints(lat1, lon1, lat2, lon2);
    */

    const [p1, p2] = locations;
    let distance = distanceBetweenPoints(p1.lat, p1.lon, p2.lat, p2.lon);

    return res.json({ locations, distance });
  } catch (err) {
    next(err);
  }
})

app.get('/map', async (req, res, next) => {
  try {
    const canvas = createCanvas(828, 642); // image size
    const ctx = canvas.getContext('2d')

    const latest = await getLastCoordinates();

    const img = new Image()
    img.onload = () => {
      ctx.drawImage(img, 0, 0)
      console.log(img.width, img.height)

      let { x, y } = latLonToOffsets(latest.lat, latest.lon, img.width, img.height);

      //let x = 200, y = 100;
      ctx.fillStyle = "#ff0000";
      ctx.fillRect(x, y, 2, 2);

      // TODO: calculate pixel offsets from lat / lon
      // TODO: draw points on map
      // https://wiki.openstreetmap.org/wiki/Zoom_levels

    }
    img.onerror = err => { throw err }
    img.src = 'img/world.png'
    // img.src = 'map/vienna.png'

    const png = canvas.createPNGStream()

    // TODO: implement caching mechanism
    // const cache = fs.createWriteStream(__dirname + '/img/cached.png')
    // png.pipe(cache)

    res.setHeader("content-type", "image/png");
    png.pipe(res)

  } catch (err) {
    return next(err)
  }
})

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

// Returns location data. Timestamp could be removed and randomized for privacy. 
app.get('/locations', async (req, res, next) => {
  try {
    const start = req.query.s || 0;
    const end = req.query.e || Number.MAX_SAFE_INTEGER;
    const minDistance = req.query.d || 0;

    let locations = await all("SELECT tst, lat, lon FROM locations WHERE (? < tst AND tst < ?)", [start, end]);

    if (minDistance > 0) {
      // only return elements which are minDistance apart from the preceding data point
      locations = locations.filter((el, index, array) => {
        if (index == 0) return true;
        const last = array[index - 1];
        return distanceBetweenPoints(last.lat, last.lon, el.lat, el.lon) >= minDistance;
      })
    }

    return res.json(locations);
  } catch (err) {
    next(err);
  }
})

// Returns status page.
app.get('/status', async (req, res, next) => {
  try {
    const { count } = await get('SELECT COUNT(*) AS count FROM locations');

    const last_n = await all(`
      SELECT lat, lon, DATETIME(tst, 'auto') AS dt 
      FROM locations 
      ORDER BY tst DESC 
      LIMIT 15
    `);

    const first = await get(`
      SELECT lat, lon, DATETIME(tst, 'auto') AS dt 
      FROM  locations 
      ORDER BY tst ASC 
      LIMIT 1
    `);

    return res.render("status", { count, latest: last_n[0], last_n, first });
  } catch (err) {
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
