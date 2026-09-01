import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import multer from 'multer';
import pg from 'pg';
import {calculateRisk} from './risk.js';

const {Pool} = pg;
const PORT = Number(process.env.PORT || 8787);
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://sweeper:sweeper_dev_only@127.0.0.1:5432/sweeper';
const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || './uploads');

fs.mkdirSync(UPLOAD_DIR, {recursive: true});

const pool = new Pool({connectionString: DATABASE_URL});
const app = express();

app.use(helmet({crossOriginResourcePolicy: false}));
app.use(cors());
app.use(express.json({limit: '2mb'}));

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname || '').slice(0, 10) || '.jpg';
      cb(null, `${crypto.randomUUID()}${ext}`);
    },
  }),
  limits: {fileSize: 12 * 1024 * 1024},
  fileFilter: (_req, file, cb) => {
    const ok = ['image/jpeg', 'image/png', 'image/heic', 'image/heif'].includes(file.mimetype);
    cb(ok ? null : new Error('Unsupported image type'), ok);
  },
});

function propertyKey({address, lat, lng}) {
  const normalizedAddress = String(address || '').trim().toLowerCase().replace(/\s+/g, ' ');
  const latBucket = Number(lat).toFixed(4);
  const lngBucket = Number(lng).toFixed(4);
  return crypto.createHash('sha256').update(`${normalizedAddress}|${latBucket}|${lngBucket}`).digest('hex');
}

function hashIdentifier(value) {
  if (!value) return null;
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function sanitizeBle(devices = []) {
  return devices.map(device => {
    const assessment =
      device.assessment && typeof device.assessment === 'object'
        ? {
            category: String(device.assessment.category || 'unknown'),
            evidenceLevel: String(
              device.assessment.evidenceLevel || 'none',
            ),
            userTitle: String(device.assessment.userTitle || ''),
            userSummary: String(device.assessment.userSummary || ''),
            matchedVendor: device.assessment.matchedVendor
              ? String(device.assessment.matchedVendor)
              : null,
            backendReview: Boolean(device.assessment.backendReview),
            bluetoothOnlyThreatEligible: false,
            evidenceCodes: Array.isArray(device.assessment.evidenceCodes)
              ? device.assessment.evidenceCodes
                  .map(String)
                  .slice(0, 20)
              : [],
          }
        : null;

    const displayName =
      device.name || device.localName
        ? String(device.name || device.localName).slice(0, 120)
        : null;

    return {
      identifierHash: hashIdentifier(device.id),
      nameHash: hashIdentifier(displayName),
      advertisedName: assessment?.backendReview
        ? displayName
        : null,
      rssi: Number.isFinite(Number(device.rssi))
        ? Number(device.rssi)
        : null,
      averageRssi: Number.isFinite(Number(device.averageRssi))
        ? Number(device.averageRssi)
        : null,
      strongestRssi: Number.isFinite(Number(device.strongestRssi))
        ? Number(device.strongestRssi)
        : null,
      sightings: Number.isFinite(Number(device.sightings))
        ? Math.max(0, Number(device.sightings))
        : 0,
      proximity: [
        'very_close',
        'nearby',
        'farther',
        'unknown',
      ].includes(device.proximity)
        ? device.proximity
        : 'unknown',
      serviceUUIDs: Array.isArray(device.serviceUUIDs)
        ? device.serviceUUIDs.map(String).slice(0, 40)
        : [],
      serviceDataUUIDs: Array.isArray(device.serviceDataUUIDs)
        ? device.serviceDataUUIDs.map(String).slice(0, 40)
        : [],
      manufacturerCompanyId: device.manufacturerCompanyId
        ? String(device.manufacturerCompanyId)
        : null,
      manufacturerLabel: device.manufacturerLabel
        ? String(device.manufacturerLabel)
        : null,
      manufacturerDataHash: hashIdentifier(
        device.manufacturerData,
      ),
      txPowerLevel: Number.isFinite(Number(device.txPowerLevel))
        ? Number(device.txPowerLevel)
        : null,
      isConnectable:
        typeof device.isConnectable === 'boolean'
          ? device.isConnectable
          : null,
      serviceSignature: device.serviceSignature
        ? String(device.serviceSignature).slice(0, 1000)
        : null,
      assessment,
      suspicionScore: Number(device.suspicionScore || 0),
      reasons: Array.isArray(device.reasons)
        ? device.reasons.map(String).slice(0, 20)
        : [],
    };
  });
}

function sanitizeNetwork(devices = []) {
  return devices.map(device => ({
    ip: String(device.ip || ''),
    hostname: device.hostname ? String(device.hostname) : null,
    icmpResponsive: Boolean(device.icmpResponsive),
    icmpRttMs: Number.isFinite(Number(device.icmpRttMs))
      ? Number(device.icmpRttMs)
      : null,
    openPorts: Array.isArray(device.openPorts)
      ? device.openPorts.map(Number).filter(Number.isFinite)
      : [],
    bonjourServices: Array.isArray(device.bonjourServices)
      ? device.bonjourServices.map(service => ({
          type: String(service.type || ''),
          name: String(service.name || ''),
          hostname: service.hostname ? String(service.hostname) : null,
          port: Number.isFinite(Number(service.port))
            ? Number(service.port)
            : null,
        }))
      : [],
    ssdpServices: Array.isArray(device.ssdpServices)
      ? device.ssdpServices.map(service => ({
          st: service.st ? String(service.st) : null,
          usn: service.usn ? String(service.usn) : null,
          location: service.location ? String(service.location) : null,
          server: service.server ? String(service.server) : null,
        }))
      : [],
    fingerprints: Array.isArray(device.fingerprints)
      ? device.fingerprints.map(fingerprint => ({
          protocol:
            fingerprint.protocol === 'rtsp' ? 'rtsp' : 'http',
          port: Number(fingerprint.port || 0),
          summary: String(fingerprint.summary || '').slice(0, 500),
          cameraHint: Boolean(fingerprint.cameraHint),
          confirmed: Boolean(fingerprint.confirmed),
        }))
      : [],
    assessment:
      device.assessment && typeof device.assessment === 'object'
        ? {
            category: String(device.assessment.category || 'unknown'),
            evidenceLevel: String(
              device.assessment.evidenceLevel || 'none',
            ),
            userTitle: String(device.assessment.userTitle || ''),
            userSummary: String(device.assessment.userSummary || ''),
            backendReview: Boolean(device.assessment.backendReview),
            networkOnlyThreatEligible: false,
            evidenceCodes: Array.isArray(device.assessment.evidenceCodes)
              ? device.assessment.evidenceCodes
                  .map(String)
                  .slice(0, 20)
              : [],
          }
        : null,
    discoverySources: Array.isArray(device.discoverySources)
      ? device.discoverySources.filter(source =>
          ['icmp', 'tcp', 'mdns', 'ssdp'].includes(source),
        )
      : [],
    reasons: Array.isArray(device.reasons)
      ? device.reasons.map(String)
      : [],
    suspicionScore: Number(device.suspicionScore || 0),
  }));
}

app.get('/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ok: true, service: 'sweeper-backend'});
  } catch (error) {
    res.status(503).json({ok: false, error: error.message});
  }
});

app.post('/api/scans', async (req, res, next) => {
  const client = await pool.connect();
  try {
    const body = req.body || {};
    const location = body.location || {};
    const lat = Number(location.lat);
    const lng = Number(location.lng);
    const providedAddress = String(location.address || '').trim();
    const fallbackAddress =
      [location.locality, location.administrativeArea, location.country]
        .filter(Boolean)
        .join(', ') || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    const address = providedAddress || fallbackAddress;

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res.status(400).json({error: 'location.lat and location.lng are required'});
    }

    const safeNetwork = sanitizeNetwork(body.networkDevices || []);
    const safeBle = sanitizeBle(body.bleDevices || []);
    const checklist = Array.isArray(body.checklist) ? body.checklist : [];
    const risk = calculateRisk({
      networkDevices: safeNetwork,
      bleDevices: body.bleDevices || [],
      checklist,
      evidencePhotoCount: Number(body.evidencePhotoCount || 0),
    });

    const key = propertyKey({address, lat, lng});
    await client.query('BEGIN');

    const propertyResult = await client.query(
      `INSERT INTO properties
        (property_key, name, address, locality, administrative_area, country, lat, lng, risk_score, total_scans, suspicious_scans)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,1,$10)
       ON CONFLICT (property_key) DO UPDATE SET
         name = COALESCE(EXCLUDED.name, properties.name),
         address = EXCLUDED.address,
         locality = COALESCE(EXCLUDED.locality, properties.locality),
         administrative_area = COALESCE(EXCLUDED.administrative_area, properties.administrative_area),
         country = COALESCE(EXCLUDED.country, properties.country),
         lat = EXCLUDED.lat,
         lng = EXCLUDED.lng,
         risk_score = ROUND((properties.risk_score * properties.total_scans + EXCLUDED.risk_score)::numeric / (properties.total_scans + 1))::int,
         total_scans = properties.total_scans + 1,
         suspicious_scans = properties.suspicious_scans + EXCLUDED.suspicious_scans,
         last_reported = now()
       RETURNING *`,
      [
        key,
        location.name || null,
        address,
        location.locality || null,
        location.administrativeArea || null,
        location.country || null,
        lat,
        lng,
        risk.score,
        risk.score >= 25 ? 1 : 0,
      ],
    );

    const property = propertyResult.rows[0];
    const scanResult = await client.query(
      `INSERT INTO scans
        (property_id, anonymous_id, network_devices, ble_devices, checklist, evidence, risk_score, risk_label, sweep_completed, notes)
       VALUES ($1,$2,$3::jsonb,$4::jsonb,$5::jsonb,$6::jsonb,$7,$8,$9,$10)
       RETURNING *`,
      [
        property.id,
        body.anonymousId || null,
        JSON.stringify(safeNetwork),
        JSON.stringify(safeBle),
        JSON.stringify(checklist),
        JSON.stringify({reasons: risk.reasons, evidencePhotoCount: Number(body.evidencePhotoCount || 0)}),
        risk.score,
        risk.label,
        Boolean(body.sweepCompleted),
        body.notes || null,
      ],
    );

    await client.query('COMMIT');
    res.status(201).json({property, scan: scanResult.rows[0], risk});
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    next(error);
  } finally {
    client.release();
  }
});

app.post('/api/scans/:scanId/photos', upload.single('photo'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({error: 'photo is required'});

    const scan = await pool.query('SELECT id FROM scans WHERE id = $1', [req.params.scanId]);
    if (scan.rowCount === 0) {
      fs.unlink(req.file.path, () => {});
      return res.status(404).json({error: 'scan not found'});
    }

    const result = await pool.query(
      `INSERT INTO photos (scan_id, stored_name, original_name, mime_type, size_bytes)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING id, scan_id, original_name, mime_type, size_bytes, created_at`,
      [req.params.scanId, req.file.filename, req.file.originalname, req.file.mimetype, req.file.size],
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

app.get('/api/properties/nearby', async (req, res, next) => {
  try {
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);
    const radiusKm = Math.min(50, Math.max(0.1, Number(req.query.radiusKm || 5)));
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res.status(400).json({error: 'lat and lng are required'});
    }

    const result = await pool.query(
      `SELECT *,
        6371 * acos(
          least(1, greatest(-1,
            cos(radians($1)) * cos(radians(lat)) * cos(radians(lng) - radians($2)) +
            sin(radians($1)) * sin(radians(lat))
          ))
        ) AS distance_km
       FROM properties
       WHERE lat BETWEEN $1 - ($3 / 111.0) AND $1 + ($3 / 111.0)
         AND lng BETWEEN $2 - ($3 / (111.0 * greatest(0.2, cos(radians($1)))))
                     AND $2 + ($3 / (111.0 * greatest(0.2, cos(radians($1)))))
       ORDER BY distance_km ASC
       LIMIT 100`,
      [lat, lng, radiusKm],
    );

    res.json(result.rows.filter(row => Number(row.distance_km) <= radiusKm));
  } catch (error) {
    next(error);
  }
});

app.get('/api/properties/:id', async (req, res, next) => {
  try {
    const property = await pool.query('SELECT * FROM properties WHERE id = $1', [req.params.id]);
    if (property.rowCount === 0) return res.status(404).json({error: 'property not found'});

    const scans = await pool.query(
      `SELECT id, scanned_at, risk_score, risk_label, sweep_completed, evidence
       FROM scans WHERE property_id = $1 ORDER BY scanned_at DESC LIMIT 25`,
      [req.params.id],
    );

    const reports = await pool.query(
      `SELECT id, status, notes, created_at, reviewed_at
       FROM reports WHERE property_id = $1 ORDER BY created_at DESC LIMIT 25`,
      [req.params.id],
    );

    res.json({property: property.rows[0], scans: scans.rows, reports: reports.rows});
  } catch (error) {
    next(error);
  }
});

app.post('/api/reports', async (req, res, next) => {
  try {
    const {propertyId, scanId = null, notes = null} = req.body || {};
    if (!propertyId) return res.status(400).json({error: 'propertyId is required'});

    const result = await pool.query(
      `INSERT INTO reports (property_id, scan_id, status, notes)
       VALUES ($1,$2,'suspected',$3)
       RETURNING *`,
      [propertyId, scanId, notes],
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({error: 'internal_error', detail: process.env.NODE_ENV === 'production' ? undefined : error.message});
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Sweeper backend listening on http://0.0.0.0:${PORT}`);
});
