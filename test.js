const request = require('supertest');
const app = require('./server');

describe('Country Currency API Tests', () => {
  
  describe('GET /', () => {
    it('should return API status', async () => {
      const res = await request(app).get('/');
      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('message');
    });
  });

  describe('GET /status', () => {
    it('should return status information', async () => {
      const res = await request(app).get('/status');
      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('total_countries');
      expect(res.body).toHaveProperty('last_refreshed_at');
    });
  });

  describe('POST /countries/refresh', () => {
    it('should refresh country data', async () => {
      const res = await request(app).post('/countries/refresh');
      expect([200, 503]).toContain(res.statusCode);
      
      if (res.statusCode === 200) {
        expect(res.body).toHaveProperty('message');
        expect(res.body).toHaveProperty('total_countries');
        expect(res.body).toHaveProperty('last_refreshed_at');
      }
    }, 60000); // 60 second timeout
  });

  describe('GET /countries', () => {
    it('should return all countries', async () => {
      const res = await request(app).get('/countries');
      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('should filter by region', async () => {
      const res = await request(app).get('/countries?region=Africa');
      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      
      if (res.body.length > 0) {
        expect(res.body[0].region).toBe('Africa');
      }
    });

    it('should filter by currency', async () => {
      const res = await request(app).get('/countries?currency=USD');
      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      
      if (res.body.length > 0) {
        expect(res.body[0].currency_code).toBe('USD');
      }
    });

    it('should sort by GDP descending', async () => {
      const res = await request(app).get('/countries?sort=gdp_desc');
      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      
      if (res.body.length > 1) {
        const first = res.body[0].estimated_gdp;
        const second = res.body[1].estimated_gdp;
        if (first !== null && second !== null) {
          expect(first).toBeGreaterThanOrEqual(second);
        }
      }
    });
  });

  describe('GET /countries/:name', () => {
    it('should return a specific country', async () => {
      // First get a country name
      const countries = await request(app).get('/countries');
      
      if (countries.body.length > 0) {
        const countryName = countries.body[0].name;
        const res = await request(app).get(`/countries/${countryName}`);
        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty('name');
        expect(res.body).toHaveProperty('currency_code');
      }
    });

    it('should return 404 for non-existent country', async () => {
      const res = await request(app).get('/countries/NonExistentCountry12345');
      expect(res.statusCode).toBe(404);
      expect(res.body).toHaveProperty('error');
      expect(res.body.error).toBe('Country not found');
    });
  });

  describe('DELETE /countries/:name', () => {
    it('should return 404 for non-existent country', async () => {
      const res = await request(app).delete('/countries/NonExistentCountry12345');
      expect(res.statusCode).toBe(404);
      expect(res.body).toHaveProperty('error');
      expect(res.body.error).toBe('Country not found');
    });
  });

  describe('GET /countries/image', () => {
    it('should return image or 404', async () => {
      const res = await request(app).get('/countries/image');
      expect([200, 404]).toContain(res.statusCode);
      
      if (res.statusCode === 200) {
        expect(res.headers['content-type']).toContain('image/png');
      } else {
        expect(res.body.error).toBe('Summary image not found');
      }
    });
  });
});

// Validation tests
describe('Data Validation Tests', () => {
  it('should have valid country structure', async () => {
    const res = await request(app).get('/countries');
    
    if (res.body.length > 0) {
      const country = res.body[0];
      expect(country).toHaveProperty('id');
      expect(country).toHaveProperty('name');
      expect(country).toHaveProperty('population');
      expect(country).toHaveProperty('last_refreshed_at');
      
      // Type checks
      expect(typeof country.id).toBe('number');
      expect(typeof country.name).toBe('string');
      expect(typeof country.population).toBe('number');
    }
  });
});
