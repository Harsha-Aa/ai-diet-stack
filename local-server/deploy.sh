#!/bin/bash

# Deployment Script for AI Diet & Meal Recommendation System
# This script helps deploy the Express.js API server to various platforms

set -e  # Exit on error

echo "=================================="
echo "AI Diet API - Deployment Script"
echo "=================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

# Check if Docker is installed
check_docker() {
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed. Please install Docker first."
        echo "Visit: https://docs.docker.com/get-docker/"
        exit 1
    fi
    print_success "Docker is installed"
}

# Check if .env file exists
check_env_file() {
    if [ ! -f .env ]; then
        print_warning ".env file not found"
        echo "Creating .env from .env.example..."
        cp .env.example .env
        print_warning "Please edit .env file with your actual values before deploying"
        exit 1
    fi
    print_success ".env file exists"
}

# Build Docker image
build_image() {
    echo ""
    echo "Building Docker image..."
    docker build -t ai-diet-api:latest .
    print_success "Docker image built successfully"
}

# Test Docker image locally
test_image() {
    echo ""
    echo "Testing Docker image locally..."
    
    # Stop existing container if running
    docker stop ai-diet-api-test 2>/dev/null || true
    docker rm ai-diet-api-test 2>/dev/null || true
    
    # Run container
    docker run -d \
        --name ai-diet-api-test \
        -p 3000:3000 \
        --env-file .env \
        ai-diet-api:latest
    
    # Wait for container to start
    echo "Waiting for container to start..."
    sleep 5
    
    # Test health endpoint
    if curl -f http://localhost:3000/health > /dev/null 2>&1; then
        print_success "Health check passed"
        docker logs ai-diet-api-test
    else
        print_error "Health check failed"
        docker logs ai-diet-api-test
        docker stop ai-diet-api-test
        docker rm ai-diet-api-test
        exit 1
    fi
    
    # Stop test container
    docker stop ai-diet-api-test
    docker rm ai-diet-api-test
    print_success "Local test completed successfully"
}

# Deploy to Render
deploy_render() {
    echo ""
    echo "Deploying to Render.com..."
    print_warning "Please follow these steps:"
    echo "1. Go to https://render.com"
    echo "2. Create a new Web Service"
    echo "3. Connect your GitHub repository"
    echo "4. Select 'Docker' as environment"
    echo "5. Set root directory to 'local-server'"
    echo "6. Add environment variables from .env file"
    echo "7. Click 'Create Web Service'"
    echo ""
    echo "For detailed instructions, see DEPLOYMENT_GUIDE.md"
}

# Deploy to Railway
deploy_railway() {
    echo ""
    echo "Deploying to Railway.app..."
    
    if ! command -v railway &> /dev/null; then
        print_warning "Railway CLI not installed"
        echo "Installing Railway CLI..."
        npm install -g @railway/cli
    fi
    
    echo "Logging in to Railway..."
    railway login
    
    echo "Initializing Railway project..."
    railway init
    
    echo "Deploying to Railway..."
    railway up
    
    print_success "Deployed to Railway"
    echo "Get your deployment URL:"
    railway domain
}

# Deploy to AWS EC2
deploy_ec2() {
    echo ""
    echo "Deploying to AWS EC2..."
    print_warning "Please follow these steps:"
    echo "1. Launch an EC2 instance (t3.small or larger)"
    echo "2. SSH into the instance"
    echo "3. Install Docker and Docker Compose"
    echo "4. Clone your repository"
    echo "5. Copy .env file to the server"
    echo "6. Run: docker-compose up -d"
    echo ""
    echo "For detailed instructions, see DEPLOYMENT_GUIDE.md"
}

# Push to Docker Hub
push_dockerhub() {
    echo ""
    read -p "Enter your Docker Hub username: " DOCKER_USERNAME
    
    if [ -z "$DOCKER_USERNAME" ]; then
        print_error "Docker Hub username is required"
        exit 1
    fi
    
    echo "Logging in to Docker Hub..."
    docker login
    
    echo "Tagging image..."
    docker tag ai-diet-api:latest $DOCKER_USERNAME/ai-diet-api:latest
    
    echo "Pushing to Docker Hub..."
    docker push $DOCKER_USERNAME/ai-diet-api:latest
    
    print_success "Image pushed to Docker Hub: $DOCKER_USERNAME/ai-diet-api:latest"
}

# Main menu
show_menu() {
    echo ""
    echo "Select deployment option:"
    echo "1) Build and test locally"
    echo "2) Deploy to Render.com"
    echo "3) Deploy to Railway.app"
    echo "4) Deploy to AWS EC2"
    echo "5) Push to Docker Hub"
    echo "6) Exit"
    echo ""
    read -p "Enter your choice [1-6]: " choice
    
    case $choice in
        1)
            check_docker
            check_env_file
            build_image
            test_image
            ;;
        2)
            check_docker
            check_env_file
            build_image
            deploy_render
            ;;
        3)
            check_docker
            check_env_file
            build_image
            deploy_railway
            ;;
        4)
            check_docker
            check_env_file
            build_image
            deploy_ec2
            ;;
        5)
            check_docker
            build_image
            push_dockerhub
            ;;
        6)
            echo "Exiting..."
            exit 0
            ;;
        *)
            print_error "Invalid choice"
            show_menu
            ;;
    esac
}

# Run main menu
show_menu

echo ""
print_success "Deployment script completed"
echo "For more information, see DEPLOYMENT_GUIDE.md"
