# 🧪 Browser Automation Test Plan

## Test Users Created

All users have password: `Test123!`

### Team Role Users:
1. **admin@hos.test** - ADMIN
2. **procurement@hos.test** - PROCUREMENT
3. **fulfillment@hos.test** - FULFILLMENT
4. **catalog@hos.test** - CATALOG
5. **marketing@hos.test** - MARKETING
6. **finance@hos.test** - FINANCE
7. **cms@hos.test** - CMS_EDITOR

### Business Role Users (if created):
- **seller@hos.test** - SELLER/B2C_SELLER
- **wholesaler@hos.test** - WHOLESALER
- **customer@hos.test** - CUSTOMER

---

## Test Scenarios

### 1. Create Team Users
- [ ] Call API endpoint: `POST /api/admin/create-team-users`
- [ ] Verify all 7 users created/updated
- [ ] Check response shows correct status

### 2. Login Flow Tests (Browser Automation)

For each user role:

#### 2.1 ADMIN User
- [ ] Navigate to `/login`
- [ ] Enter: `admin@hos.test` / `Test123!`
- [ ] Submit login
- [ ] Verify redirect to `/admin/dashboard`
- [ ] Verify dashboard displays admin-specific data
- [ ] Verify header shows user email and role
- [ ] Verify logout works

#### 2.2 PROCUREMENT User
- [ ] Navigate to `/login`
- [ ] Enter: `procurement@hos.test` / `Test123!`
- [ ] Submit login
- [ ] Verify redirect to `/procurement/dashboard`
- [ ] Verify dashboard displays procurement-specific data
- [ ] Verify access denied for `/admin/dashboard`

#### 2.3 FULFILLMENT User
- [ ] Navigate to `/login`
- [ ] Enter: `fulfillment@hos.test` / `Test123!`
- [ ] Submit login
- [ ] Verify redirect to `/fulfillment/dashboard`
- [ ] Verify dashboard displays fulfillment-specific data

#### 2.4 CATALOG User
- [ ] Navigate to `/login`
- [ ] Enter: `catalog@hos.test` / `Test123!`
- [ ] Submit login
- [ ] Verify redirect to `/catalog/dashboard`
- [ ] Verify dashboard displays catalog-specific data

#### 2.5 MARKETING User
- [ ] Navigate to `/login`
- [ ] Enter: `marketing@hos.test` / `Test123!`
- [ ] Submit login
- [ ] Verify redirect to `/marketing/dashboard`
- [ ] Verify dashboard displays marketing-specific data

#### 2.6 FINANCE User
- [ ] Navigate to `/login`
- [ ] Enter: `finance@hos.test` / `Test123!`
- [ ] Submit login
- [ ] Verify redirect to `/finance/dashboard`
- [ ] Verify dashboard displays finance-specific data

#### 2.7 CMS_EDITOR User
- [ ] Navigate to `/login`
- [ ] Enter: `cms@hos.test` / `Test123!`
- [ ] Submit login
- [ ] Verify redirect to appropriate dashboard (or home)
- [ ] Verify access permissions

### 3. Route Protection Tests

- [ ] Test unauthenticated access to protected routes
- [ ] Verify redirect to `/login`
- [ ] Test authenticated access to wrong role dashboard
- [ ] Verify redirect to `/access-denied` or role-specific dashboard
- [ ] Test logout clears session and redirects

### 4. Dashboard Data Tests

For each dashboard:
- [ ] Verify data loads without errors
- [ ] Verify loading state displays
- [ ] Verify empty states display when no data
- [ ] Verify error states display on API failure
- [ ] Verify statistics are displayed correctly
- [ ] Verify recent activity/data lists work

---

## Browser Automation Script

Will use browser automation to:
1. Navigate to login page
2. Fill credentials
3. Submit form
4. Wait for redirect
5. Verify dashboard content
6. Take screenshots for verification
7. Test navigation and logout

---

## Expected Results

✅ All team users created successfully
✅ Each user can log in
✅ Each user redirects to correct dashboard
✅ Dashboards display real data from API
✅ Route protection works correctly
✅ Unauthorized access shows access denied
✅ Logout clears session

---

## Next Steps After Testing

1. Fix any route protection issues
2. Fix any dashboard data display issues
3. Add additional test users if needed
4. Document any bugs or improvements needed
5. Proceed with remaining RBAC implementation

