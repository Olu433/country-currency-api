#!/bin/bash

# Country Currency API - Quick Setup Script
# This script helps you set up the project quickly on Linux/Mac

set -e

echo "======================================"
echo "Country Currency API - Setup Script"
echo "======================================"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if Node.js is installed
echo -n "Checking Node.js installation... "
if ! command -v node &> /dev/null; then
    echo -e "${RED}Failed${NC}"
    echo "Node.js is not installed. Please install Node.js v16 or higher."
    echo "Visit: https://nodejs.org"
    exit 1
fi
NODE_VERSION=$(node -v)
echo -e "${GREEN}OK${NC} ($NODE_VERSION)"

# Check if npm is installed
echo -n "Checking npm installation... "
if ! command -v npm &> /dev/null; then
    echo -e "${RED}Failed${NC}"
    echo "npm is not installed."
    exit 1
fi
NPM_VERSION=$(npm -v)
echo -e "${GREEN}OK${NC} ($NPM_VERSION)"

# Check if MySQL is installed
echo -n "Checking MySQL installation... "
if ! command -v mysql &> /dev/null; then
    echo -e "${YELLOW}Warning${NC}"
    echo "MySQL is not installed or not in PATH."
    echo "Please install MySQL 5.7+ before continuing."
    echo ""
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
else
    echo -e "${GREEN}OK${NC}"
fi

echo ""
echo "======================================"
echo "Installing Dependencies"
echo "======================================"
npm install

echo ""
echo "======================================"
echo "Setting Up Environment Variables"
echo "======================================"

if [ -f .env ]; then
    echo -e "${YELLOW}Warning:${NC} .env file already exists."
    read -p "Do you want to overwrite it? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Skipping .env setup."
    else
        rm .env
    fi
fi

if [ ! -f .env ]; then
    echo "Creating .env file..."
    
    # Get database configuration
    read -p "Database host [localhost]: " DB_HOST
    DB_HOST=${DB_HOST:-localhost}
    
    read -p "Database user [root]: " DB_USER
    DB_USER=${DB_USER:-root}
    
    read -sp "Database password: " DB_PASSWORD
    echo
    
    read -p "Database name [countries_db]: " DB_NAME
    DB_NAME=${DB_NAME:-countries_db}
    
    read -p "Server port [3000]: " PORT
    PORT=${PORT:-3000}
    
    # Create .env file
    cat > .env << EOF
# Server Configuration
PORT=$PORT

# Database Configuration
DB_HOST=$DB_HOST
DB_USER=$DB_USER
DB_PASSWORD=$DB_PASSWORD
DB_NAME=$DB_NAME
EOF
    
    echo -e "${GREEN}✓${NC} .env file created"
fi

echo ""
echo "======================================"
echo "Setting Up Database"
echo "======================================"

# Try to create database
echo "Attempting to create database..."
if command -v mysql &> /dev/null; then
    mysql -u $DB_USER -p$DB_PASSWORD -e "CREATE DATABASE IF NOT EXISTS $DB_NAME CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;" 2>/dev/null && echo -e "${GREEN}✓${NC} Database created/verified" || echo -e "${YELLOW}⚠${NC} Could not create database. Please create it manually."
else
    echo -e "${YELLOW}⚠${NC} MySQL command not available. Please create the database manually:"
    echo "  CREATE DATABASE $DB_NAME CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
fi

echo ""
echo "======================================"
echo "Creating Required Directories"
echo "======================================"
mkdir -p cache
echo -e "${GREEN}✓${NC} cache/ directory created"

echo ""
echo "======================================"
echo "Setup Complete!"
echo "======================================"
echo ""
echo "To start the server:"
echo "  npm start          (production mode)"
echo "  npm run dev        (development mode with auto-reload)"
echo ""
echo "After starting, test your API:"
echo "  curl http://localhost:$PORT/"
echo "  curl -X POST http://localhost:$PORT/countries/refresh"
echo ""
echo -e "${GREEN}Happy coding!${NC} 🚀"
