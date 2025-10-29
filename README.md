# Country Currency & Exchange API

A RESTful API that fetches country data from external APIs, stores it in a MySQL database, and provides CRUD operations with currency exchange rate calculations.

## Features

- Fetch and cache country data from [REST Countries API](https://restcountries.com)
- Retrieve real-time exchange rates from [ExchangeRate API](https://open.er-api.com)
- Calculate estimated GDP based on population and exchange rates
- Generate visual summaries of country data
- Filter and sort countries by region, currency, and GDP
- Full CRUD operations with validation

## Tech Stack

- **Runtime**: Node.js (v16+)
- **Framework**: Express.js
- **Database**: MySQL
- **Image Generation**: node-canvas
- **HTTP Client**: axios

## Prerequisites

- Node.js v16 or higher
- MySQL 5.7 or higher
- npm or yarn package manager

## Installation

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/country-currency-api.git
cd country-currency-api
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Set Up Environment Variables

Create a `.env` file in the root directory:

```bash
cp .env.example .env
```

Edit `.env` with your configuration:

```env
PORT=3000
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=countries_db
```

### 4. Set Up MySQL Database

Create the database:

```sql
CREATE DATABASE countries_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

The application will automatically create the required tables on startup.

### 5. Run the Application

**Development mode (with auto-reload):**
```bash
npm run dev
```

**Production mode:**
```bash
npm start
```

The server will start on `http://localhost:3000`

## API Endpoints

### 1. Refresh Country Data

**POST** `/countries/refresh`

Fetches fresh data from external APIs and updates the database.

**Response:**
```json
{
  "message": "Countries data refreshed successfully",
  "total_countries": 250,
  "last_refreshed_at": "2025-10-28T18:00:00Z"
}
```

**Error Responses:**
- `503 Service Unavailable` - External API unavailable
- `500 Internal Server Error` - Database or processing error

---

### 2. Get All Countries

**GET** `/countries`

Retrieves all countries with optional filtering and sorting.

**Query Parameters:**
- `region` - Filter by region (e.g., `Africa`, `Europe`)
- `currency` - Filter by currency code (e.g., `NGN`, `USD`)
- `sort` - Sort results:
  - `gdp_desc` - Sort by GDP (highest first)
  - `gdp_asc` - Sort by GDP (lowest first)
  - `population_desc` - Sort by population (highest first)
  - `population_asc` - Sort by population (lowest first)

**Example Requests:**
```bash
GET /countries
GET /countries?region=Africa
GET /countries?currency=NGN
GET /countries?region=Africa&sort=gdp_desc
```

**Response:**
```json
[
  {
    "id": 1,
    "name": "Nigeria",
    "capital": "Abuja",
    "region": "Africa",
    "population": 206139589,
    "currency_code": "NGN",
    "exchange_rate": 1600.23,
    "estimated_gdp": 25767448125.2,
    "flag_url": "https://flagcdn.com/ng.svg",
    "last_refreshed_at": "2025-10-28T18:00:00Z"
  }
]
```

---

### 3. Get Country by Name

**GET** `/countries/:name`

Retrieves a specific country by name (case-insensitive).

**Example:**
```bash
GET /countries/Nigeria
```

**Response:**
```json
{
  "id": 1,
  "name": "Nigeria",
  "capital": "Abuja",
  "region": "Africa",
  "population": 206139589,
  "currency_code": "NGN",
  "exchange_rate": 1600.23,
  "estimated_gdp": 25767448125.2,
  "flag_url": "https://flagcdn.com/ng.svg",
  "last_refreshed_at": "2025-10-28T18:00:00Z"
}
```

**Error Response:**
```json
{
  "error": "Country not found"
}
```

---

### 4. Delete Country

**DELETE** `/countries/:name`

Deletes a country record by name (case-insensitive).

**Example:**
```bash
DELETE /countries/Nigeria
```

**Response:**
```json
{
  "message": "Country deleted successfully"
}
```

**Error Response:**
```json
{
  "error": "Country not found"
}
```

---

### 5. Get Status

**GET** `/status`

Returns the total number of countries and last refresh timestamp.

**Response:**
```json
{
  "total_countries": 250,
  "last_refreshed_at": "2025-10-28T18:00:00Z"
}
```

---

### 6. Get Summary Image

**GET** `/countries/image`

Returns a PNG image with summary statistics.

**Response:**
- Content-Type: `image/png`
- Visual summary showing:
  - Total countries
  - Top 5 countries by GDP
  - Last refresh timestamp

**Error Response:**
```json
{
  "error": "Summary image not found"
}
```

## Data Processing Logic

### Currency Handling
1. If a country has multiple currencies, only the first is stored
2. If currencies array is empty:
   - `currency_code` = `null`
   - `exchange_rate` = `null`
   - `estimated_gdp` = `0`
3. If currency code not found in exchange rates:
   - `exchange_rate` = `null`
   - `estimated_gdp` = `null`

### GDP Calculation
```
estimated_gdp = (population × random(1000-2000)) ÷ exchange_rate
```
- Random multiplier regenerated on each refresh
- Set to `null` if exchange rate unavailable

### Update/Insert Logic
- Matches existing countries by name (case-insensitive)
- Updates all fields if exists
- Inserts new record if not exists
- Recalculates GDP with fresh random multiplier

## Database Schema

### Countries Table
```sql
CREATE TABLE countries (
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
);
```

### Refresh Status Table
```sql
CREATE TABLE refresh_status (
  id INT PRIMARY KEY DEFAULT 1,
  last_refreshed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  total_countries INT DEFAULT 0,
  CHECK (id = 1)
);
```

## Error Handling

All errors return JSON responses:

| Status Code | Error Type | Example Response |
|-------------|-----------|------------------|
| 400 | Bad Request | `{"error": "Validation failed"}` |
| 404 | Not Found | `{"error": "Country not found"}` |
| 500 | Internal Error | `{"error": "Internal server error"}` |
| 503 | Service Unavailable | `{"error": "External data source unavailable", "details": "..."}` |

## Deployment

### Railway

1. Create a new project on Railway
2. Add MySQL database addon
3. Connect your GitHub repository
4. Set environment variables (Railway auto-sets DATABASE_URL)
5. Deploy

### Heroku

1. Create a new Heroku app
2. Add ClearDB MySQL addon: `heroku addons:create cleardb:ignite`
3. Push code: `git push heroku main`
4. Set environment variables

### AWS EC2

1. Launch an EC2 instance
2. Install Node.js and MySQL
3. Clone repository and install dependencies
4. Set up environment variables
5. Use PM2 for process management: `pm2 start server.js`

## Testing

Run tests:
```bash
npm test
```

Manual testing with curl:
```bash
# Refresh data
curl -X POST http://localhost:3000/countries/refresh

# Get all countries
curl http://localhost:3000/countries

# Filter by region
curl http://localhost:3000/countries?region=Africa

# Get specific country
curl http://localhost:3000/countries/Nigeria

# Get status
curl http://localhost:3000/status

# Get image
curl http://localhost:3000/countries/image --output summary.png
```

## Project Structure

```
country-currency-api/
├── server.js           # Main application file
├── package.json        # Dependencies and scripts
├── .env               # Environment variables (not in git)
├── .env.example       # Example environment variables
├── .gitignore         # Git ignore file
├── README.md          # Documentation
└── cache/             # Generated images directory
    └── summary.png    # Auto-generated summary image
```

## Dependencies

- **express**: Web framework
- **mysql2**: MySQL client with promise support
- **axios**: HTTP client for external APIs
- **dotenv**: Environment variable management
- **canvas**: Image generation library

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

## License

MIT License

## Support

For issues or questions, please open an issue on GitHub.

## External APIs Used

- [REST Countries API](https://restcountries.com/v2/all) - Country data
- [ExchangeRate-API](https://open.er-api.com/v6/latest/USD) - Currency exchange rates

---

**Built with ❤️ for HNG Backend Stage 2**
