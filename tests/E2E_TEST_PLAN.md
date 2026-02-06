# E2E Test Plan - Clock-Bill Application

## Overview
This document outlines the End-to-End (E2E) test coverage for critical user flows in the Clock-Bill time tracking application.

## Critical User Flows to Test

### 1. Authentication Flow
#### 1.1 User Registration
- [ ] Navigate to /register
- [ ] Fill registration form with valid data
- [ ] Verify email format validation
- [ ] Verify password confirmation matching
- [ ] Submit and verify redirect to dashboard
- [ ] Verify user is logged in

#### 1.2 User Login
- [ ] Navigate to /login
- [ ] Fill email and password
- [ ] Submit and verify redirect to dashboard
- [ ] Verify session persists on page refresh

#### 1.3 User Logout
- [ ] Click logout from user menu
- [ ] Verify redirect to login page
- [ ] Verify session is cleared

### 2. Client Management Flow
#### 2.1 Create Client
- [ ] Navigate to /clients
- [ ] Click "Add client" button
- [ ] Fill client form (name, email, phone, rate)
- [ ] Submit form
- [ ] Verify client appears in list
- [ ] Verify data persists after refresh

#### 2.2 View Client Details
- [ ] Click on a client from list
- [ ] Verify client details page loads
- [ ] Verify all client information displays correctly

#### 2.3 Edit Client
- [ ] Navigate to client details
- [ ] Click "Edit" button
- [ ] Modify client information
- [ ] Save changes
- [ ] Verify updated information displays

#### 2.4 Deactivate Client
- [ ] Navigate to client details
- [ ] Click "Deactivate" button
- [ ] Confirm deactivation
- [ ] Verify client shows as inactive
- [ ] Verify client doesn't appear in active filters

### 3. Project Management Flow
#### 3.1 Create Project
- [ ] Navigate to /clients
- [ ] Select a client
- [ ] Click "Add project" button
- [ ] Fill project form (name, pricing model, rates)
- [ ] Test different pricing models (hourly, package, mixed)
- [ ] Submit form
- [ ] Verify project appears in client's project list

#### 3.2 View Project Details
- [ ] Click on a project from list
- [ ] Verify project details page loads
- [ ] Verify pricing model displays correctly
- [ ] Verify project statistics show

#### 3.3 Edit Project
- [ ] Navigate to project details
- [ ] Click "Edit" button
- [ ] Modify project information
- [ ] Save changes
- [ ] Verify updated information displays

### 4. Time Entry Flow
#### 4.1 Start Live Timer
- [ ] Click "Start timer" button (from dashboard or /entries)
- [ ] Select client and project
- [ ] Add description
- [ ] Verify timer starts and shows elapsed time
- [ ] Navigate to different pages
- [ ] Verify timer persists and continues counting

#### 4.2 Stop Timer
- [ ] With timer running, click "Stop" button
- [ ] Verify timer stops
- [ ] Verify entry is saved and appears in list
- [ ] Verify duration is calculated correctly

#### 4.3 Manual Time Entry
- [ ] Navigate to /entries
- [ ] Click "Add entry" button
- [ ] Select client, project, date
- [ ] Set start and end times OR duration
- [ ] Add description and tags
- [ ] Save entry
- [ ] Verify entry appears in list with correct data

#### 4.4 Edit Time Entry
- [ ] Click edit on an existing entry
- [ ] Modify entry details
- [ ] Save changes
- [ ] Verify updated entry displays correctly

#### 4.5 Delete Time Entry
- [ ] Click delete on an entry
- [ ] Confirm deletion
- [ ] Verify entry is removed from list
- [ ] Verify dashboard stats update

### 5. Dashboard Flow
#### 5.1 View Dashboard Statistics
- [ ] Navigate to dashboard (/)
- [ ] Verify today's hours display correctly
- [ ] Verify week's hours display correctly
- [ ] Verify month's hours display correctly
- [ ] Verify recent entries list shows

#### 5.2 Quick Actions from Dashboard
- [ ] Click "Start timer" from dashboard
- [ ] Verify timer widget appears
- [ ] Navigate to clients from dashboard
- [ ] Navigate to entries from dashboard

### 6. Reports Flow
#### 6.1 Generate PDF Report
- [ ] Navigate to /reports
- [ ] Select date range
- [ ] Filter by client (optional)
- [ ] Filter by project (optional)
- [ ] Select PDF template
- [ ] Click "Generate PDF"
- [ ] Verify PDF is generated and downloads

#### 6.2 Export to Excel
- [ ] Navigate to /reports
- [ ] Set filters for report
- [ ] Click "Export Excel"
- [ ] Verify Excel file downloads

### 7. Settings Flow
#### 7.1 Update Business Profile
- [ ] Navigate to /settings
- [ ] Update business name
- [ ] Add phone number
- [ ] Add address
- [ ] Save changes
- [ ] Verify updates persist

#### 7.2 Upload Logo
- [ ] Navigate to /settings
- [ ] Upload logo image
- [ ] Verify logo appears in preview
- [ ] Save settings
- [ ] Verify logo appears in reports

#### 7.3 Change Password
- [ ] Navigate to /settings
- [ ] Go to security tab
- [ ] Enter current password
- [ ] Enter new password
- [ ] Confirm new password
- [ ] Submit
- [ ] Verify password was changed

### 8. Filter and Search Flow
#### 8.1 Filter Entries by Date Range
- [ ] Navigate to /entries
- [ ] Set date range filter
- [ ] Verify only entries in range display

#### 8.2 Filter Entries by Client
- [ ] Navigate to /entries
- [ ] Select client from filter
- [ ] Verify only entries for that client display

#### 8.3 Filter Entries by Project
- [ ] Navigate to /entries
- [ ] Select project from filter
- [ ] Verify only entries for that project display

#### 8.4 Filter Entries by Tag
- [ ] Navigate to /entries
- [ ] Select tag from filter
- [ ] Verify only entries with that tag display

#### 8.5 Search Clients
- [ ] Navigate to /clients
- [ ] Type in search box
- [ ] Verify search filters client list

### 9. Data Persistence Flow
#### 9.1 Cross-Session Persistence
- [ ] Create a test client
- [ ] Logout
- [ ] Login again
- [ ] Verify client still exists

#### 9.2 Server Restart Persistence
- [ ] Create a test entry with unique data
- [ ] Verify entry exists in UI
- [ ] Stop dev server
- [ ] Start dev server
- [ ] Login and verify entry still exists

### 10. RTL and Hebrew Flow
#### 10.1 RTL Layout Verification
- [ ] Verify all pages use RTL layout
- [ ] Verify text alignment is correct (right-aligned)
- [ ] Verify padding/margins use logical properties
- [ ] Verify Hebrew text displays correctly

#### 10.2 Hebrew UI Verification
- [ ] Verify all labels are in Hebrew
- [ ] Verify all error messages are in Hebrew
- [ ] Verify all validation messages are in Hebrew
- [ ] Verify date/time formatting uses Hebrew conventions

### 11. Responsive Design Flow
#### 11.1 Mobile View
- [ ] Resize browser to mobile width (< 768px)
- [ ] Verify sidebar collapses/hides
- [ ] Verify mobile menu works
- [ ] Verify all pages are usable on mobile

#### 11.2 Desktop View
- [ ] Verify layouts look good on desktop
- [ ] Verify tables display correctly
- [ ] Verify forms are usable

### 12. Error Handling Flow
#### 12.1 Validation Errors
- [ ] Submit form with invalid data
- [ ] Verify error message displays
- [ ] Verify form doesn't submit
- [ ] Fix validation error
- [ ] Verify form submits successfully

#### 12.2 API Errors
- [ ] Simulate network error (disconnect from network)
- [ ] Try to submit form
- [ ] Verify appropriate error message displays
- [ ] Reconnect network
- [ ] Verify app recovers

### 13. Security Flow
#### 13.1 Protected Routes
- [ ] Try to access /dashboard while logged out
- [ ] Verify redirect to /login
- [ ] Try to access /clients while logged out
- [ ] Verify redirect to /login
- [ ] Try to access API endpoints without auth
- [ ] Verify 401 response

#### 13.2 Data Isolation
- [ ] Create data as user A
- [ ] Logout
- [ ] Login as user B
- [ ] Verify user B cannot see user A's data

### 14. Timer Persistence Flow
#### 14.1 Timer Across Navigation
- [ ] Start a timer
- [ ] Navigate to different pages
- [ ] Verify timer continues running
- [ ] Verify elapsed time updates correctly

#### 14.2 Timer Across Browser Sessions
- [ ] Start a timer
- [ ] Close browser tab
- [ ] Reopen application
- [ ] Verify timer is still running
- [ ] Verify elapsed time is accurate

## Test Execution Status

### Manual Browser Testing (Playwright MCP)
- [ ] Authentication flow tested
- [ ] Client management tested
- [ ] Project management tested
- [ ] Time entry flow tested
- [ ] Timer functionality tested
- [ ] Dashboard statistics tested
- [ ] Report generation tested
- [ ] Settings and profile tested
- [ ] Filters and search tested
- [ ] RTL layout verified
- [ ] Data persistence verified
- [ ] Security verified

### Automated Unit Tests
- [x] format.test.ts - Date/time formatting functions
- [x] validation.test.ts - Form validation functions

## Tools Used
- **Manual Testing**: Playwright MCP browser automation
- **Unit Tests**: Custom test runner with tsx
- **Future**: Playwright test runner for automated E2E

## Notes
- E2E tests currently performed manually via browser automation
- Future implementation should use Playwright test runner with automated scripts
- Critical flows should be tested before each release
- All tests should verify RTL and Hebrew language support
