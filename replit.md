# InsureCare+ - Smart Health Insurance System

## Overview

A premium health insurance management web application built with vanilla HTML, CSS, and JavaScript. No frameworks used.

## Stack

- **Frontend**: HTML5, CSS3, JavaScript (ES Modules)
- **Dev Server**: Vite
- **Package manager**: pnpm
- **Monorepo**: pnpm workspaces

## Architecture

Single-page application with 5 modules:
- **Dashboard**: Overview stats, recent activity, premium breakdown
- **Customers**: Add/manage customers with age and disease status
- **Policy**: Create policies with coverage amounts, premium calculation
- **Claims**: File claims with document upload (drag-drop), process with approval/rejection logic
- **Documents**: View/preview uploaded files

## Business Logic

- Premium = $3,000 base + age factor + disease loading
  - Age < 25: +$500
  - Age 25-50: +$1,000
  - Age > 50: +$2,000
  - Pre-existing disease: +$2,000
- Claim: Approved if amount <= coverage, Rejected otherwise

## Key Files

- `artifacts/insurecare/index.html` - Main HTML structure
- `artifacts/insurecare/src/styles.css` - All CSS (glassmorphism, gradients, responsive)
- `artifacts/insurecare/src/script.js` - All business logic and DOM manipulation
- `artifacts/insurecare/vite.config.ts` - Vite dev server config

## Features

- Glassmorphism card design
- Toast notifications
- Modal popups
- Loading spinner for claim processing
- Animated number counters
- Status badges (green/red/yellow)
- Drag-and-drop file upload
- Document preview
- Responsive sidebar navigation
- Smooth CSS animations
