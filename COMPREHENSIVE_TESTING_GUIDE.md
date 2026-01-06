# 🧪 Comprehensive Frontend Testing Guide

## 🎯 Testing Session Overview

This guide will walk you through testing the deployed House of Spells Marketplace frontend application using the admin credentials.

---

## 📋 Pre-Testing Checklist

- [ ] Frontend URL is accessible
- [ ] Backend API URL is accessible
- [ ] Admin credentials ready:
  - Email: `app@houseofspells.co.uk`
  - Password: `Admin123`

---

## 🌐 Step 1: Access the Frontend

### Get Your Frontend URL

1. Go to **Railway Dashboard**: https://railway.app
2. Select **`@hos-marketplace/web`** service
3. Go to **Settings** → **Domains**
4. Copy the public URL (e.g., `https://your-app.railway.app`)

### Open in Browser

Open the URL in your browser to start testing.

---

## 🔐 Step 2: Login Testing

### Test Admin Login

1. **Navigate to Login Page**
   - Look for "Login" or "Sign In" button/link
   - URL should be: `/login` or `/auth/login`

2. **Enter Credentials**
   - Email: `app@houseofspells.co.uk`
   - Password: `Admin123`

3. **Click Login**
   - Should redirect to dashboard or home page
   - Check for user info/avatar in header
   - Verify admin role is displayed (if shown)

4. **Verify Session**
   - Check browser DevTools → Application → Cookies
   - Look for auth token/session cookie
   - Verify token is present

---

## 🏠 Step 3: Home Page Testing

### Test Home Page Features

1. **Hero Banner**
   - [ ] Auto-playing carousel works
   - [ ] Navigation arrows work
   - [ ] Indicators (dots) work
   - [ ] Clicking banners navigates correctly
   - [ ] Images load properly

2. **Banner Carousel**
   - [ ] Scrolling banners animate smoothly
   - [ ] Clicking banners navigates to correct pages
   - [ ] Badges display correctly (New, Hot, Limited, Sale)

3. **Feature Banners**
   - [ ] Two feature banners display
   - [ ] Images load correctly
   - [ ] Buttons work and navigate correctly
   - [ ] Text is readable

4. **Fandom Collection**
   - [ ] Fandom cards display
   - [ ] Clicking fandoms navigates correctly
   - [ ] Images load properly

5. **Recently Viewed**
   - [ ] Section displays (may be empty initially)
   - [ ] Layout is correct

6. **Navigation**
   - [ ] Header navigation works
   - [ ] Footer links work
   - [ ] Search bar is functional
   - [ ] Cart icon displays (if items in cart)

---

## 🛍️ Step 4: Product Browsing

### Test Product Features

1. **Product Listing**
   - Navigate to `/products` or click "Products" in nav
   - [ ] Products display in grid/list
   - [ ] Product images load
   - [ ] Product names, prices, descriptions show
   - [ ] Filters work (if available)

2. **Product Details**
   - Click on any product
   - [ ] Product details page loads
   - [ ] All product info displays
   - [ ] Images gallery works (if multiple images)
   - [ ] Add to cart button works
   - [ ] Add to wishlist works (if available)

3. **Fandom Pages**
   - Navigate to `/fandoms/harry-potter` (or other)
   - [ ] Fandom page loads
   - [ ] Products for that fandom display
   - [ ] Fandom description/info shows

---

## 🛒 Step 5: Shopping Cart

### Test Cart Functionality

1. **Add to Cart**
   - Add a product to cart
   - [ ] Cart icon updates with count
   - [ ] Success message appears (if implemented)

2. **View Cart**
   - Click cart icon or navigate to `/cart`
   - [ ] Cart page loads
   - [ ] Added items display
   - [ ] Quantities can be updated
   - [ ] Remove item works
   - [ ] Total price calculates correctly

3. **Empty Cart**
   - Remove all items
   - [ ] Empty cart message displays
   - [ ] "Continue Shopping" link works

---

## 👤 Step 6: User Profile & Admin Features

### Test Admin Access

1. **User Profile**
   - Navigate to profile/account page
   - [ ] User info displays correctly
   - [ ] Email shows: `app@houseofspells.co.uk`
   - [ ] Role shows: `ADMIN` (if displayed)

2. **Admin Dashboard** (if available)
   - Look for "Admin" or "Dashboard" link
   - [ ] Admin dashboard loads
   - [ ] Admin-only features accessible
   - [ ] User management works (if available)
   - [ ] Product management works (if available)

3. **Account Settings**
   - [ ] Can update profile info
   - [ ] Can change password
   - [ ] Can update preferences

---

## 🔍 Step 7: Search Functionality

### Test Search Features

1. **Search Bar**
   - Type a search query in header search bar
   - [ ] Search results display
   - [ ] Results are relevant
   - [ ] Can navigate to product from results

2. **Search Page**
   - Navigate to `/search?q=wand` (or similar)
   - [ ] Search results page loads
   - [ ] Filters work (if available)
   - [ ] Sorting works (if available)

---

## 📱 Step 8: Responsive Design

### Test Mobile/Tablet Views

1. **Resize Browser**
   - Open DevTools (F12)
   - Toggle device toolbar (Ctrl+Shift+M / Cmd+Shift+M)
   - Test different screen sizes:
     - [ ] Mobile (375px)
     - [ ] Tablet (768px)
     - [ ] Desktop (1920px)

2. **Mobile Features**
   - [ ] Navigation menu works (hamburger menu)
   - [ ] Text is readable
   - [ ] Buttons are tappable
   - [ ] Images scale correctly
   - [ ] No horizontal scrolling

---

## 🎨 Step 9: Theme & Styling

### Test Visual Elements

1. **Fonts**
   - [ ] Cinzel font displays for headings
   - [ ] Lora font displays for body text
   - [ ] Text is readable and styled correctly

2. **Colors**
   - [ ] Purple/indigo theme colors display
   - [ ] Amber/gold accents visible
   - [ ] Contrast is good (readability)

3. **Components**
   - [ ] Buttons styled correctly
   - [ ] Cards have proper shadows/borders
   - [ ] Forms are styled
   - [ ] Loading states work (if implemented)

---

## ⚡ Step 10: Performance & Errors

### Test Performance

1. **Page Load**
   - [ ] Pages load quickly (< 3 seconds)
   - [ ] Images lazy load (if implemented)
   - [ ] No console errors

2. **Network Tab**
   - Open DevTools → Network
   - [ ] API calls succeed
   - [ ] No failed requests
   - [ ] Response times are reasonable

3. **Console Errors**
   - Open DevTools → Console
   - [ ] No JavaScript errors
   - [ ] No 404 errors for assets
   - [ ] No CORS errors

---

## 🔗 Step 11: API Integration

### Test Backend Connection

1. **API Calls**
   - Check Network tab in DevTools
   - [ ] Login API call succeeds
   - [ ] Product API calls work
   - [ ] Cart API calls work
   - [ ] User API calls work

2. **Error Handling**
   - Test with invalid credentials
   - [ ] Error messages display correctly
   - [ ] Network errors handled gracefully

---

## 📝 Step 12: Form Validation

### Test Forms

1. **Login Form**
   - [ ] Empty fields show validation errors
   - [ ] Invalid email format shows error
   - [ ] Wrong password shows error

2. **Registration Form** (if available)
   - [ ] All fields validate
   - [ ] Password strength checked
   - [ ] Email format validated

---

## 🧪 Step 13: Edge Cases

### Test Edge Cases

1. **Empty States**
   - [ ] Empty cart displays message
   - [ ] No products found displays message
   - [ ] Empty search results handled

2. **Loading States**
   - [ ] Loading spinners show during API calls
   - [ ] Skeleton screens display (if implemented)

3. **Error States**
   - [ ] 404 page works
   - [ ] 500 errors handled
   - [ ] Network errors handled

---

## ✅ Testing Checklist Summary

### Critical Features
- [ ] Login works with admin credentials
- [ ] Home page loads and displays correctly
- [ ] Products display and can be viewed
- [ ] Cart functionality works
- [ ] Navigation works throughout site
- [ ] No console errors
- [ ] API calls succeed

### Nice-to-Have Features
- [ ] Search works
- [ ] Responsive design works
- [ ] Theme/styling is correct
- [ ] Admin features accessible
- [ ] Forms validate correctly

---

## 🐛 Reporting Issues

If you find issues during testing:

1. **Take Screenshots**
   - Screenshot the error/issue
   - Include browser console errors

2. **Note Details**
   - What page/feature
   - What action you took
   - Expected vs actual behavior
   - Browser/device info

3. **Check Network Tab**
   - Note any failed API calls
   - Check response status codes
   - Look for CORS errors

---

## 🎯 Next Steps After Testing

1. **Fix Critical Issues**
   - Address any blocking bugs
   - Fix authentication issues
   - Resolve API connection problems

2. **Improve UX**
   - Enhance error messages
   - Improve loading states
   - Optimize performance

3. **Add Missing Features**
   - Implement any missing functionality
   - Add admin features
   - Enhance user experience

---

**Ready to start testing!** 🚀

Open your deployed frontend URL and follow this guide step by step.



