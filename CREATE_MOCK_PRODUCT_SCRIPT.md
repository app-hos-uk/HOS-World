# Script to Create Mock Product via Browser Console

## Method 1: Direct API Call via Browser Console

Open browser console (F12) and run:

```javascript
// Get auth token
const token = localStorage.getItem('auth_token');
const apiUrl = 'https://hos-marketplaceapi-production.up.railway.app/api/v1';

// Mock product data
const mockProduct = {
  name: "Harry Potter Official Wand - Elder Wand Replica",
  description: "Authentic replica of the Elder Wand from the Harry Potter series. Made from high-quality materials with intricate detailing. Perfect for collectors and fans of the wizarding world.",
  sku: "HP-EW-001",
  barcode: "1234567890123",
  ean: "9781234567890",
  fandom: "Harry Potter",
  isPlatformOwned: true,
  status: "DRAFT",
  price: 0,
  stock: 0,
  currency: "GBP"
};

// Create product
fetch(`${apiUrl}/admin/products`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify(mockProduct)
})
.then(res => res.json())
.then(data => {
  console.log('✅ Product created:', data);
  return data;
})
.catch(err => console.error('❌ Error:', err));
```

## Method 2: Fill Form via DOM Manipulation

```javascript
// Fill form fields
document.querySelector('input[name="Product name"]').value = "Harry Potter Official Wand - Elder Wand Replica";
document.querySelector('textarea[name="Product description"]').value = "Authentic replica of the Elder Wand from the Harry Potter series. Made from high-quality materials with intricate detailing. Perfect for collectors and fans of the wizarding world.";
document.querySelector('input[placeholder*="SKU"]').value = "HP-EW-001";
document.querySelector('input[placeholder*="Barcode"]').value = "1234567890123";
document.querySelector('input[placeholder*="EAN"]').value = "9781234567890";
document.querySelector('input[placeholder*="Harry Potter"]').value = "Harry Potter";

// Check platform owned
const checkbox = document.querySelector('input[type="checkbox"]');
if (checkbox) checkbox.checked = true;

// Submit form
document.querySelector('button:contains("Create Product")').click();
```

## Method 3: Use apiClient (if available in window)

```javascript
// Check if apiClient is available
if (window.apiClient) {
  window.apiClient.createAdminProduct({
    name: "Harry Potter Official Wand - Elder Wand Replica",
    description: "Authentic replica of the Elder Wand from the Harry Potter series.",
    sku: "HP-EW-001",
    barcode: "1234567890123",
    ean: "9781234567890",
    fandom: "Harry Potter",
    isPlatformOwned: true,
    status: "DRAFT",
    price: 0,
    stock: 0
  }).then(data => console.log('✅ Product created:', data));
}
```
