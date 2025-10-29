require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const axios = require('axios');
const { createCanvas } = require('canvas');
const fs = require('fs').promises;
const path = require('path');

const app = express();
app.use(express.json());

// Smart database configuration for Railway and local development
let dbConfig;

if (process.env.MYSQL_URL || process.env.DATABASE_URL) {
  // Railway or other cloud platforms with connection URL
  const dbUrl = process.env.MYSQL_URL || process.env.DATABASE_URL;
  
  try {
    const url = new URL(dbUrl);
    dbConfig = {
      host: url.hostname,
      user: url.username,
      password: url.password,
      database: url.pathname.slice(1) || 'railway',
      port: parseInt(url.port) || 3306,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      connectTimeout: 60000
    };
    console.log(`📡 Connecting to cloud database at ${url.hostname}:${url.port}`);
  } catch (error) {
    console.error('❌ Failed to parse database URL:', error.message);
    process.exit(1);
  }
} else {
  // Local development with individual environment variables
  dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'countries_db',
    port: parseInt(process.env.DB_PORT) || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  };
  console.log(`💻 Connecting to local database at ${dbConfig.host}:${dbConfig.port}`);
}

// Create connection pool
const pool = mysql.createPool(dbConfig);

// Test database connection
async function testConnection() {
  try {
    const connection = await pool.getConnection();
    await connection.query('SELECT 1');
    console.log('✅ Database connection successful!');
    connection.release();
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    return false;
  }
}

// Initialize database tables
async function initDatabase() {
  const connection = await pool.getConnection();
  try {
    console.log('🔧 Initializing database tables...');
    
    // Create countries table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS countries (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        capital VARCHAR(255),
        region VARCHAR(100),
        population BIGINT NOT NULL,
        currency_code VARCHAR(10),
        exchange_rate DECIMAL(20, 6),
        estimated_gdp DECIMAL(30, 2),
        flag_url TEXT,
        last_refreshed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_region (region),
        INDEX idx_currency (currency_code),
        INDEX idx_name (name)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // Create refresh status table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS refresh_status (
        id INT PRIMARY KEY DEFAULT 1,
        last_refreshed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        total_countries INT DEFAULT 0,
        CHECK (id = 1)
      )
    `);

    // Initialize refresh status
    await connection.query(`
      INSERT IGNORE INTO refresh_status (id) VALUES (1)
    `);

    console.log('✅ Database tables initialized successfully');
  } catch (error) {
    console.error('❌ Database initialization failed:', error.message);
    throw error;
  } finally {
    connection.release();
  }
}

// Generate summary image
async function generateSummaryImage(totalCountries, topCountries, timestamp) {
  try {
    await fs.mkdir('cache', { recursive: true });

    const width = 800;
    const height = 600;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // Background gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, '#1a1a2e');
    gradient.addColorStop(1, '#16213e');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // Title
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 32px Arial';
    ctx.fillText('Country Data Summary', 50, 60);

    // Total countries
    ctx.font = '24px Arial';
    ctx.fillStyle = '#16c79a';
    ctx.fillText(`Total Countries: ${totalCountries}`, 50, 120);

    // Timestamp
    ctx.font = '18px Arial';
    ctx.fillStyle = '#aaaaaa';
    ctx.fillText(`Last Updated: ${new Date(timestamp).toLocaleString()}`, 50, 160);

    // Top 5 countries by GDP
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px Arial';
    ctx.fillText('Top 5 Countries by Estimated GDP', 50, 220);

    ctx.font = '18px Arial';
    let yPos = 260;
    topCountries.forEach((country, index) => {
      const gdpFormatted = country.estimated_gdp 
        ? `$${parseFloat(country.estimated_gdp).toLocaleString('en-US', { maximumFractionDigits: 0 })}`
        : 'N/A';
      
      ctx.fillStyle = '#16c79a';
      ctx.fillText(`${index + 1}.`, 50, yPos);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(`${country.name}`, 90, yPos);
      ctx.fillStyle = '#aaaaaa';
      ctx.fillText(gdpFormatted, 400, yPos);
      yPos += 40;
    });

    const buffer = canvas.toBuffer('image/png');
    await fs.writeFile(path.join('cache', 'summary.png'), buffer);
    
    console.log('📊 Summary image generated successfully');
  } catch (error) {
    console.error('❌ Error generating summary image:', error.message);
  }
}

// POST /countries/refresh
app.post('/countries/refresh', async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    console.log('🔄 Starting data refresh...');

    // Fetch countries data with timeout
    console.log('📥 Fetching countries data...');
    const countriesResponse = await axios.get(
      'https://restcountries.com/v2/all?fields=name,capital,region,population,flag,currencies',
      { timeout: 30000 }
    ).catch(err => {
      throw new Error('Could not fetch data from restcountries.com');
    });

    // Fetch exchange rates with timeout
    console.log('💱 Fetching exchange rates...');
    const exchangeResponse = await axios.get(
      'https://open.er-api.com/v6/latest/USD',
      { timeout: 30000 }
    ).catch(err => {
      throw new Error('Could not fetch data from open.er-api.com');
    });

    const exchangeRates = exchangeResponse.data.rates;
    const countries = countriesResponse.data;

    console.log(`📊 Processing ${countries.length} countries...`);

    for (const country of countries) {
      const name = country.name;
      const capital = country.capital || null;
      const region = country.region || null;
      const population = country.population || 0;
      const flagUrl = country.flag || null;

      let currencyCode = null;
      let exchangeRate = null;
      let estimatedGdp = 0;

      // Handle currency
      if (country.currencies && country.currencies.length > 0) {
        currencyCode = country.currencies[0].code;
        
        if (exchangeRates[currencyCode]) {
          exchangeRate = exchangeRates[currencyCode];
          const randomMultiplier = Math.random() * (2000 - 1000) + 1000;
          estimatedGdp = (population * randomMultiplier) / exchangeRate;
        } else {
          estimatedGdp = null;
        }
      }

      // Upsert country (insert or update if exists)
      await connection.query(`
        INSERT INTO countries (name, capital, region, population, currency_code, exchange_rate, estimated_gdp, flag_url, last_refreshed_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
        ON DUPLICATE KEY UPDATE
          capital = VALUES(capital),
          region = VALUES(region),
          population = VALUES(population),
          currency_code = VALUES(currency_code),
          exchange_rate = VALUES(exchange_rate),
          estimated_gdp = VALUES(estimated_gdp),
          flag_url = VALUES(flag_url),
          last_refreshed_at = NOW()
      `, [name, capital, region, population, currencyCode, exchangeRate, estimatedGdp, flagUrl]);
    }

    // Update refresh status
    const [countResult] = await connection.query('SELECT COUNT(*) as total FROM countries');
    const totalCountries = countResult[0].total;

    await connection.query(`
      UPDATE refresh_status SET last_refreshed_at = NOW(), total_countries = ? WHERE id = 1
    `, [totalCountries]);

    await connection.commit();
    console.log('✅ Data refresh completed successfully');

    // Generate summary image
    console.log('🎨 Generating summary image...');
    const [topCountries] = await connection.query(`
      SELECT name, estimated_gdp FROM countries
      WHERE estimated_gdp IS NOT NULL
      ORDER BY estimated_gdp DESC
      LIMIT 5
    `);

    const [statusResult] = await connection.query('SELECT last_refreshed_at FROM refresh_status WHERE id = 1');
    await generateSummaryImage(totalCountries, topCountries, statusResult[0].last_refreshed_at);

    res.json({
      message: 'Countries data refreshed successfully',
      total_countries: totalCountries,
      last_refreshed_at: statusResult[0].last_refreshed_at
    });

  } catch (error) {
    await connection.rollback();
    console.error('❌ Refresh error:', error.message);
    
    if (error.message.includes('Could not fetch data')) {
      return res.status(503).json({
        error: 'External data source unavailable',
        details: error.message
      });
    }
    
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    connection.release();
  }
});

// GET /countries
app.get('/countries', async (req, res) => {
  try {
    const { region, currency, sort } = req.query;
    
    let query = 'SELECT * FROM countries WHERE 1=1';
    const params = [];

    if (region) {
      query += ' AND region = ?';
      params.push(region);
    }

    if (currency) {
      query += ' AND currency_code = ?';
      params.push(currency);
    }

    if (sort === 'gdp_desc') {
      query += ' ORDER BY estimated_gdp DESC';
    } else if (sort === 'gdp_asc') {
      query += ' ORDER BY estimated_gdp ASC';
    } else if (sort === 'population_desc') {
      query += ' ORDER BY population DESC';
    } else if (sort === 'population_asc') {
      query += ' ORDER BY population ASC';
    } else {
      query += ' ORDER BY name ASC';
    }

    const [countries] = await pool.query(query, params);
    
    res.json(countries.map(c => ({
      id: c.id,
      name: c.name,
      capital: c.capital,
      region: c.region,
      population: c.population,
      currency_code: c.currency_code,
      exchange_rate: c.exchange_rate ? parseFloat(c.exchange_rate) : null,
      estimated_gdp: c.estimated_gdp ? parseFloat(c.estimated_gdp) : null,
      flag_url: c.flag_url,
      last_refreshed_at: c.last_refreshed_at
    })));
  } catch (error) {
    console.error('❌ Get countries error:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /countries/:name
app.get('/countries/:name', async (req, res) => {
  try {
    const [countries] = await pool.query(
      'SELECT * FROM countries WHERE LOWER(name) = LOWER(?)',
      [req.params.name]
    );

    if (countries.length === 0) {
      return res.status(404).json({ error: 'Country not found' });
    }

    const c = countries[0];
    res.json({
      id: c.id,
      name: c.name,
      capital: c.capital,
      region: c.region,
      population: c.population,
      currency_code: c.currency_code,
      exchange_rate: c.exchange_rate ? parseFloat(c.exchange_rate) : null,
      estimated_gdp: c.estimated_gdp ? parseFloat(c.estimated_gdp) : null,
      flag_url: c.flag_url,
      last_refreshed_at: c.last_refreshed_at
    });
  } catch (error) {
    console.error('❌ Get country error:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /countries/:name
app.delete('/countries/:name', async (req, res) => {
  try {
    const [result] = await pool.query(
      'DELETE FROM countries WHERE LOWER(name) = LOWER(?)',
      [req.params.name]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Country not found' });
    }

    res.json({ message: 'Country deleted successfully' });
  } catch (error) {
    console.error('❌ Delete country error:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /status
app.get('/status', async (req, res) => {
  try {
    const [result] = await pool.query('SELECT total_countries, last_refreshed_at FROM refresh_status WHERE id = 1');
    
    if (result.length === 0) {
      return res.json({
        total_countries: 0,
        last_refreshed_at: null
      });
    }

    res.json({
      total_countries: result[0].total_countries,
      last_refreshed_at: result[0].last_refreshed_at
    });
  } catch (error) {
    console.error('❌ Status error:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /countries/image
app.get('/countries/image', async (req, res) => {
  try {
    const imagePath = path.join(__dirname, 'cache', 'summary.png');
    await fs.access(imagePath);
    res.sendFile(imagePath);
  } catch (error) {
    res.status(404).json({ error: 'Summary image not found' });
  }
});

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ 
    message: 'Country Currency & Exchange API is running',
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

// 404 handler for undefined routes
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('❌ Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    // Test database connection
    const isConnected = await testConnection();
    if (!isConnected) {
      throw new Error('Database connection failed');
    }

    // Initialize database tables
    await initDatabase();

    // Start Express server
    app.listen(PORT, '0.0.0.0', () => {
      console.log('════════════════════════════════════════');
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🌐 Health check: http://localhost:${PORT}/`);
      console.log('════════════════════════════════════════');
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error.message);
    console.error('💡 Please check your database configuration');
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  console.log('⚠️  SIGTERM received, closing server gracefully...');
  await pool.end();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('⚠️  SIGINT received, closing server gracefully...');
  await pool.end();
  process.exit(0);
});

// Start the server
startServer();
