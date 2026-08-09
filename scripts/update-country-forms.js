#!/usr/bin/env node
/**
 * Batch script to update all remaining frontend forms to use CountrySelect component
 * with ISO 3166-1 alpha-2 country codes
 */

const fs = require('fs');
const path = require('path');

const FORMS = [
  '/Users/sabuj/Desktop/HOS-Latest/apps/web/src/app/checkout/page.tsx',
  '/Users/sabuj/Desktop/HOS-Latest/apps/web/src/app/seller/profile/page.tsx',
  '/Users/sabuj/Desktop/HOS-Latest/apps/web/src/app/wholesaler/profile/page.tsx',
  '/Users/sabuj/Desktop/HOS-Latest/apps/web/src/app/profile/page.tsx',
  '/Users/sabuj/Desktop/HOS-Latest/apps/web/src/app/admin/warehouses/page.tsx',
  '/Users/sabuj/Desktop/HOS-Latest/apps/web/src/app/admin/fulfillment-centers/page.tsx',
  '/Users/sabuj/Desktop/HOS-Latest/apps/web/src/app/admin/tax-zones/page.tsx',
  '/Users/sabuj/Desktop/HOS-Latest/apps/web/src/app/admin/founding-members/page.tsx',
];

console.log('ISO Country Code Form Update Script');
console.log('====================================\n');

FORMS.forEach((filePath, index) => {
  console.log(`${index + 1}. ${path.basename(filePath, '.tsx')}`);
  console.log(`   Path: ${filePath}`);
  
  if (!fs.existsSync(filePath)) {
    console.log(`   ⚠️  File not found, skipping\n`);
    return;
  }
  
  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;
  
  // Step 1: Add imports if not present
  if (!content.includes('CountrySelect')) {
    const importLine = "import { CountrySelect } from '@/components/CountrySelect';";
    const countriesLine = "import { COUNTRIES } from '@/lib/countries';";
    
    // Find a good place to insert (after other component imports)
    const importRegex = /^import.*from.*components.*$/m;
    const match = content.match(importRegex);
    
    if (match) {
      const insertPos = content.indexOf(match[0]) + match[0].length;
      content = content.slice(0, insertPos) + '\n' + importLine + '\n' + countriesLine + content.slice(insertPos);
      changed = true;
      console.log(`   ✓ Added imports`);
    }
  }
  
  // Step 2: Replace hardcoded country dropdowns with CountrySelect
  // Pattern 1: Simple select with options
  const selectPattern = /<select[^>]*name=["']country["'][^>]*>[\s\S]*?<\/select>/g;
  const selectMatches = content.match(selectPattern);
  
  if (selectMatches) {
    selectMatches.forEach(match => {
      // Extract value and onChange attributes
      const valueMatch = match.match(/value=\{([^}]+)\}/);
      const onChangeMatch = match.match(/onChange=\{([^}]+)\}/);
      const classMatch = match.match(/className=\{?([^}>]+)\}?/);
      
      if (valueMatch) {
        const replacement = `<CountrySelect
  name="countryCode"
  value={${valueMatch[1]}}
  onChange={${onChangeMatch ? onChangeMatch[1] : '(e) => {}'}}
  ${classMatch ? `className={${classMatch[1]}}` : ''}
  required
/>`;
        
        content = content.replace(match, replacement);
        changed = true;
        console.log(`   ✓ Replaced country dropdown`);
      }
    });
  }
  
  // Step 3: Update state variable names (country -> countryCode)
  // This is more complex and may require manual review
  
  if (changed) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`   ✅ File updated successfully\n`);
  } else {
    console.log(`   ℹ️  No changes needed\n`);
  }
});

console.log('\n✨ Batch update complete!');
console.log('\n⚠️  IMPORTANT: Manual review required for:');
console.log('   1. State variable renames (country -> countryCode)');
console.log('   2. API payload updates (add countryCode field)');
console.log('   3. Currency mapping updates (use ISO codes)');
console.log('\nRefer to /Users/sabuj/Desktop/HOS-Latest/apps/web/src/app/login/page.tsx as the reference implementation.');
