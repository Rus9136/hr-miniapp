# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.5.0] - 2025-06-18

### Added
- Structured documentation in `/docs` directory
- API documentation with all endpoints
- Deployment guide with Docker instructions
- Troubleshooting guide for common issues

### Changed
- Updated CLAUDE.md with simplified structure
- Reorganized project documentation

### Removed
- 92 temporary files including:
  - 37 session log files
  - 18 test HTML files
  - 11 temporary JS test files
  - 14 log files
  - 7 temporary MD documents
  - 5 backup files

### Fixed
- Project size optimized from ~200MB to 128MB
- Documentation structure improved for Claude Code

## [1.4.0] - 2025-06-11

### Added
- iOS WebView full support with platform adapters
- IOSAdapter for native iOS app integration
- Platform detection system (Web/Telegram/iOS)
- iOS-specific styles and navigation

### Fixed
- Critical navigation conflicts between global and local handlers
- Admin panel buttons redirecting to login
- User menu buttons not responding
- Event listener management in dynamic content

## [1.3.0] - 2025-06-08

### Added
- News system with full CRUD operations
- Company news display in main menu
- News article detail view
- Account unlinking feature for Telegram
- Settings screen with account management

### Fixed
- News API endpoint conflicts
- Navigation flow after viewing articles
- Event listener reconnection issues

## [1.2.0] - 2025-06-04

### Added
- Night shift calculation system
- Universal shift detection (8h, 12h, 14h, 24h)
- 1C work schedules integration (115 schedules)
- Employee schedule assignments (422 employees)
- Schedule import from 1C system

### Fixed
- Negative hours calculation for night shifts
- Midnight transition handling (22:00-06:00)
- Schedule display in department statistics

## [1.1.0] - 2025-06-01

### Added
- Telegram Mini App integration
- Automatic platform detection
- HMAC-SHA256 validation for Telegram
- Account linking system (Telegram ID ↔ IIN)
- Haptic feedback for Telegram
- JWT token authentication

### Changed
- Database migrated from SQLite to PostgreSQL
- Authentication now uses IIN instead of table number
- Added Docker containerization
- HTTPS deployment configuration

### Security
- SSL certificates with Let's Encrypt
- CORS configuration for Telegram
- Rate limiting on API endpoints

## [1.0.0] - 2025-05-30

### Added
- Initial release
- Employee time tracking system
- Monthly calendar view
- Time event recording
- Statistics calculation
- Admin panel with data management
- External API integration
- Excel timesheet import
- Department hierarchy
- Position management

### Features
- Login by IIN (12 digits)
- Personal dashboard
- Monthly attendance calendar
- Time tracking display
- Status indicators (on-time, late, early departure)
- Admin panel with full CRUD
- Responsive design

## [0.1.0] - 2025-05-01

### Added
- Project initialization
- Basic database schema
- Initial API endpoints
- Frontend structure