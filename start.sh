#!/bin/bash

# Credit Card Checker - Auto Port Detection and Startup Script
# This script automatically detects available ports and starts the system

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default ports
DEFAULT_BACKEND_PORT=5000
DEFAULT_FRONTEND_PORT=3000
DEFAULT_MONGO_PORT=27017

# Function to check if port is in use
check_port() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        return 0  # Port is in use
    else
        return 1  # Port is free
    fi
}

# Function to find next available port
find_available_port() {
    local start_port=$1
    local port=$start_port
    
    while check_port $port; do
        port=$((port + 1))
        if [ $port -gt $((start_port + 100)) ]; then
            echo -e "${RED}Error: Could not find available port after checking 100 ports from $start_port${NC}"
            exit 1
        fi
    done
    
    echo $port
}

# Function to update environment files
update_env_files() {
    local backend_port=$1
    local frontend_port=$2
    local mongo_port=$3
    
    # Update backend .env
    if [ -f "backend/.env" ]; then
        sed -i.bak "s/PORT=.*/PORT=$backend_port/" backend/.env
        sed -i.bak "s/MONGODB_URI=.*/MONGODB_URI=mongodb:\/\/admin:password123@localhost:$mongo_port\/credit_card_checker?authSource=admin/" backend/.env
    fi
    
    # Update frontend .env.local
    if [ -f "frontend/.env.local" ]; then
        sed -i.bak "s/NEXT_PUBLIC_API_URL=.*/NEXT_PUBLIC_API_URL=http:\/\/localhost:$backend_port\/api/" frontend/.env.local
    fi
    
    # Update docker-compose.yml
    if [ -f "docker-compose.yml" ]; then
        sed -i.bak "s/\"$DEFAULT_BACKEND_PORT:5000\"/\"$backend_port:5000\"/" docker-compose.yml
        sed -i.bak "s/\"$DEFAULT_FRONTEND_PORT:3000\"/\"$frontend_port:3000\"/" docker-compose.yml
        sed -i.bak "s/\"$DEFAULT_MONGO_PORT:27017\"/\"$mongo_port:27017\"/" docker-compose.yml
        sed -i.bak "s/NEXT_PUBLIC_API_URL=.*/NEXT_PUBLIC_API_URL=http:\/\/localhost:$backend_port\/api/" docker-compose.yml
    fi
}

# Function to restore original files
restore_files() {
    echo -e "${YELLOW}Restoring original configuration files...${NC}"
    [ -f "backend/.env.bak" ] && mv backend/.env.bak backend/.env
    [ -f "frontend/.env.local.bak" ] && mv frontend/.env.local.bak frontend/.env.local
    [ -f "docker-compose.yml.bak" ] && mv docker-compose.yml.bak docker-compose.yml
}

# Function to cleanup on exit
cleanup() {
    echo -e "\n${YELLOW}Cleaning up...${NC}"
    restore_files
    exit 0
}

# Trap cleanup on script exit
trap cleanup EXIT INT TERM

echo -e "${BLUE}=== Credit Card Checker - Auto Port Detection ===${NC}"
echo -e "${BLUE}Checking for available ports...${NC}"

# Check and find available ports
MONGO_PORT=$DEFAULT_MONGO_PORT
if check_port $MONGO_PORT; then
    MONGO_PORT=$(find_available_port $DEFAULT_MONGO_PORT)
    echo -e "${YELLOW}MongoDB port $DEFAULT_MONGO_PORT is in use, using port $MONGO_PORT${NC}"
else
    echo -e "${GREEN}MongoDB port $MONGO_PORT is available${NC}"
fi

BACKEND_PORT=$DEFAULT_BACKEND_PORT
if check_port $BACKEND_PORT; then
    BACKEND_PORT=$(find_available_port $DEFAULT_BACKEND_PORT)
    echo -e "${YELLOW}Backend port $DEFAULT_BACKEND_PORT is in use, using port $BACKEND_PORT${NC}"
else
    echo -e "${GREEN}Backend port $BACKEND_PORT is available${NC}"
fi

FRONTEND_PORT=$DEFAULT_FRONTEND_PORT
if check_port $FRONTEND_PORT; then
    FRONTEND_PORT=$(find_available_port $DEFAULT_FRONTEND_PORT)
    echo -e "${YELLOW}Frontend port $DEFAULT_FRONTEND_PORT is in use, using port $FRONTEND_PORT${NC}"
else
    echo -e "${GREEN}Frontend port $FRONTEND_PORT is available${NC}"
fi

echo -e "\n${BLUE}=== Port Configuration ===${NC}"
echo -e "MongoDB:  ${GREEN}$MONGO_PORT${NC}"
echo -e "Backend:  ${GREEN}$BACKEND_PORT${NC}"
echo -e "Frontend: ${GREEN}$FRONTEND_PORT${NC}"

# Update configuration files
echo -e "\n${BLUE}Updating configuration files...${NC}"
update_env_files $BACKEND_PORT $FRONTEND_PORT $MONGO_PORT

# Check if Docker is running
if ! docker info >/dev/null 2>&1; then
    echo -e "${RED}Error: Docker is not running. Please start Docker Desktop and try again.${NC}"
    exit 1
fi

# Start the system
echo -e "\n${BLUE}=== Starting Credit Card Checker System ===${NC}"

# Option to choose startup method
echo -e "${YELLOW}Choose startup method:${NC}"
echo -e "1) Docker Compose (Recommended for production)"
echo -e "2) Development mode (Backend + Frontend separately)"
echo -e "3) Backend only"
echo -e "4) Frontend only"
read -p "Enter your choice (1-4): " choice

case $choice in
    1)
        echo -e "${BLUE}Starting with Docker Compose...${NC}"
        docker-compose up --build -d
        echo -e "\n${GREEN}=== System Started Successfully! ===${NC}"
        echo -e "Frontend: ${GREEN}http://localhost:$FRONTEND_PORT${NC}"
        echo -e "Backend:  ${GREEN}http://localhost:$BACKEND_PORT${NC}"
        echo -e "MongoDB:  ${GREEN}localhost:$MONGO_PORT${NC}"
        echo -e "\n${YELLOW}To stop the system: docker-compose down${NC}"
        ;;
    2)
        echo -e "${BLUE}Starting in development mode...${NC}"
        
        # Start MongoDB
        echo -e "${BLUE}Starting MongoDB...${NC}"
        docker-compose up -d mongodb
        
        # Wait for MongoDB to be ready
        echo -e "${BLUE}Waiting for MongoDB to be ready...${NC}"
        sleep 10
        
        # Start backend in background
        echo -e "${BLUE}Starting Backend...${NC}"
        cd backend
        npm install
        npm run dev &
        BACKEND_PID=$!
        cd ..
        
        # Wait for backend to start
        sleep 5
        
        # Start frontend in background
        echo -e "${BLUE}Starting Frontend...${NC}"
        cd frontend
        npm install
        npm run dev &
        FRONTEND_PID=$!
        cd ..
        
        echo -e "\n${GREEN}=== Development System Started! ===${NC}"
        echo -e "Frontend: ${GREEN}http://localhost:$FRONTEND_PORT${NC}"
        echo -e "Backend:  ${GREEN}http://localhost:$BACKEND_PORT${NC}"
        echo -e "MongoDB:  ${GREEN}localhost:$MONGO_PORT${NC}"
        echo -e "\n${YELLOW}Press Ctrl+C to stop all services${NC}"
        
        # Wait for user to stop
        wait $BACKEND_PID $FRONTEND_PID
        ;;
    3)
        echo -e "${BLUE}Starting Backend only...${NC}"
        docker-compose up -d mongodb
        sleep 10
        cd backend
        npm install
        npm run dev
        ;;
    4)
        echo -e "${BLUE}Starting Frontend only...${NC}"
        cd frontend
        npm install
        npm run dev
        ;;
    *)
        echo -e "${RED}Invalid choice. Exiting.${NC}"
        exit 1
        ;;
esac
