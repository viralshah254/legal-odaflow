#!/bin/bash

# Quick log viewer for Legal OdaFlow services
# This script provides easy access to logs without using the web UI
# Usage: ./view-logs.sh [service_name] [--tail N] [--follow]

# Function to check if service exists
service_exists() {
    local service_name=$1
    docker service ls --format "{{.Name}}" | grep -q "^${service_name}$"
}

# Function to show service logs
show_logs() {
    local service_name=$1
    local lines=${2:-50}
    local follow=${3:-false}
    
    # Check if service exists
    if ! service_exists "$service_name"; then
        echo ""
        echo "❌ Service '$service_name' not found!"
        echo "Available services:"
        docker service ls --format "table {{.Name}}\t{{.Mode}}\t{{.Replicas}}\t{{.Image}}"
        return 1
    fi
    
    echo ""
    if [ "$follow" = "true" ]; then
        if [ "$lines" -gt 0 ]; then
            echo "🔍 Showing last $lines lines for $service_name, then following (Ctrl+C to stop):"
            echo "----------------------------------------"
            docker service logs --tail $lines $service_name
            echo ""
            echo "🔄 Now following new logs..."
            echo "----------------------------------------"
        else
            echo "🔄 Following logs for $service_name (Ctrl+C to stop):"
            echo "----------------------------------------"
        fi
        docker service logs -f $service_name
    else
        echo "🔍 Showing last $lines lines for $service_name:"
        echo "----------------------------------------"
        docker service logs --tail $lines $service_name
    fi
}

# Check for command line arguments
if [ $# -gt 0 ]; then
    service_name=$1
    shift
    
    # Parse additional arguments
    tail_lines=50
    follow_mode=false
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            --tail)
                tail_lines="$2"
                shift 2
                ;;
            --follow|-f)
                follow_mode=true
                shift
                ;;
            *)
                echo "Unknown option: $1"
                echo "Usage: $0 [service_name] [--tail N] [--follow|-f]"
                echo "Examples:"
                echo "  $0 legal-backend_app --tail 200"
                echo "  $0 legal-backend_app --follow"
                echo "  $0 legal-backend_app --tail 200 --follow"
                echo "  $0 legal-backend_app --tail 200 -f"
                exit 1
                ;;
        esac
    done
    
    # Show logs directly
    show_logs "$service_name" "$tail_lines" "$follow_mode"
    exit 0
fi

echo "📋 Legal OdaFlow Service Logs"
echo "======================"

# Check if services are running
echo "📊 Checking service status..."
docker service ls

echo ""
echo "Select a service to view logs:"
echo "1) legal-backend_app (main application)"
echo "2) legal-backend_redis (Redis cache)"
echo "3) legal-backend_portainer (monitoring UI)"
echo "4) All services (last 20 lines each)"
echo "5) Follow logs (real-time) for app"
echo "6) Follow logs (real-time) for redis"
echo "7) Follow logs (real-time) for portainer"
echo "8) Custom number of lines for app"
echo "9) Custom number of lines for redis"
echo "10) Custom number of lines for portainer"
echo ""

read -p "Enter choice (1-10): " choice

case $choice in
    1)
        show_logs "legal-backend_app" 100
        ;;
    2)
        show_logs "legal-backend_redis" 50
        ;;
    3)
        show_logs "legal-backend_portainer" 50
        ;;
    4)
        echo "📋 All Services Logs (last 20 lines each):"
        echo "=========================================="
        show_logs "legal-backend_app" 20
        show_logs "legal-backend_redis" 20
        show_logs "legal-backend_portainer" 20
        ;;
    5)
        show_logs "legal-backend_app" 0 "true"
        ;;
    6)
        show_logs "legal-backend_redis" 0 "true"
        ;;
    7)
        show_logs "legal-backend_portainer" 0 "true"
        ;;
    8)
        read -p "Enter number of lines for app logs (e.g., 200): " custom_lines
        if [[ "$custom_lines" =~ ^[0-9]+$ ]]; then
            show_logs "legal-backend_app" "$custom_lines"
        else
            echo "❌ Invalid number. Using default 50 lines."
            show_logs "legal-backend_app" 50
        fi
        ;;
    9)
        read -p "Enter number of lines for redis logs (e.g., 200): " custom_lines
        if [[ "$custom_lines" =~ ^[0-9]+$ ]]; then
            show_logs "legal-backend_redis" "$custom_lines"
        else
            echo "❌ Invalid number. Using default 50 lines."
            show_logs "legal-backend_redis" 50
        fi
        ;;
    10)
        read -p "Enter number of lines for portainer logs (e.g., 200): " custom_lines
        if [[ "$custom_lines" =~ ^[0-9]+$ ]]; then
            show_logs "legal-backend_portainer" "$custom_lines"
        else
            echo "❌ Invalid number. Using default 50 lines."
            show_logs "legal-backend_portainer" 50
        fi
        ;;
    *)
        echo "❌ Invalid choice"
        exit 1
        ;;
esac

echo ""
echo "💡 Tip: Use 'docker service logs -f <service_name>' to follow logs in real-time"
echo "💡 Tip: Visit http://localhost:9000 for a web-based log viewer"
