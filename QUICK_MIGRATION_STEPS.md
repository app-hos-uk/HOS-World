# ⚡ Quick Migration Steps

## 🎯 Run Migration in 30 Seconds

1. **Open Browser Console** (F12 or Cmd+Option+I)
2. **Go to Console tab**
3. **Copy and paste this code:**

```javascript
// Get auth token
const token = localStorage.getItem('token') || localStorage.getItem('authToken') || sessionStorage.getItem('token') || sessionStorage.getItem('authToken');

if (!token) {
  console.error('❌ No token found. Please log in again.');
} else {
  console.log('🔄 Running migration...');
  
  fetch('https://hos-marketplaceapi-production.up.railway.app/api/admin/migration/run-global-features', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  })
  .then(response => response.json())
  .then(data => {
    console.log('✅ Migration Result:', data);
    if (data.success) {
      console.log('🎉 Migration completed!');
      console.log(`✅ ${data.summary.successful} statements succeeded`);
      console.log(`⚠️ ${data.summary.errors} errors (may be expected)`);
      console.log('📋 Refresh the page to see changes');
    } else {
      console.error('❌ Migration failed:', data.error);
    }
  })
  .catch(error => {
    console.error('❌ Error:', error);
  });
}
```

4. **Press Enter**
5. **Wait for the result** - you'll see it in the console
6. **Refresh the page** after migration completes

---

## ✅ That's It!

The migration will:
- Add missing database columns
- Create required tables
- Fix the 500 errors you're seeing

After migration, refresh the page and the errors should be gone!

