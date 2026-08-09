#!/usr/bin/env node
/**
 * Complete ISO Country Code implementation for remaining frontend forms
 */

const fs = require('fs');
const path = require('path');

const webRoot = '/Users/sabuj/Desktop/HOS-Latest/apps/web/src/app';

// Clean up duplicate imports
function cleanDuplicateImports(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const seen = new Set();
  const cleaned = [];
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('import') && seen.has(trimmed)) {
      continue; // Skip duplicate
    }
    if (trimmed.startsWith('import')) {
      seen.add(trimmed);
    }
    cleaned.push(line);
  }
  
  fs.writeFileSync(filePath, cleaned.join('\n'), 'utf8');
}

// Update country select dropdowns
function updateCountryDropdowns(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;
  
  // Pattern 1: Replace <select with name="country"> that has hardcoded options
  const selectRegex = /<select([^>]*name=["']country["'][^>]*)>\s*<option[^>]*>Select[^<]*<\/option>\s*<option[^>]*>United States<\/option>/gs;
  
  if (selectRegex.test(content)) {
    // Extract attributes from select tag
    content = content.replace(selectRegex, (match) => {
      const idMatch = match.match(/id=["']([^"']+)["']/);
      const valueMatch = match.match(/value=\{([^}]+)\}/);
      const onChangeMatch = match.match(/onChange=\{([^}]+)\}/);
      const classMatch = match.match(/className=["']([^"']+)["']/);
      const requiredMatch = match.match(/required/);
      
      const id = idMatch ? idMatch[1] : 'country';
      const value = valueMatch ? valueMatch[1] : 'formData.country';
      const onChange = onChangeMatch ? onChangeMatch[1] : '() => {}';
      const className = classMatch ? classMatch[1] : '';
      const required = requiredMatch ? 'required' : '';
      
      return `<CountrySelect
        id="${id}"
        name="countryCode"
        value={${value.replace('country', 'countryCode')}}
        onChange={${onChange}}
        ${required}
        className="${className}"
      />`;
    });
    changed = true;
  }
  
  if (changed) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✓ Updated: ${path.basename(filePath)}`);
  }
}

// Main execution
const files = [
  'seller/profile/page.tsx',
  'wholesaler/profile/page.tsx',
  'profile/page.tsx',
  'admin/warehouses/page.tsx',
  'admin/fulfillment-centers/page.tsx',
  'admin/tax-zones/page.tsx',
];

console.log('ISO Country Code - Final Form Updates\n');

files.forEach(file => {
  const fullPath = path.join(webRoot, file);
  if (fs.existsSync(fullPath)) {
    console.log(`Processing: ${file}`);
    cleanDuplicateImports(fullPath);
    updateCountryDropdowns(fullPath);
  } else {
    console.log(`⚠ Not found: ${file}`);
  }
});

console.log('\n✅ Complete! Manual verification recommended.');
