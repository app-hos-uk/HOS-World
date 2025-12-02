'use client';

import Link from 'next/link';
import { useTheme } from '@hos-marketplace/theme-system';

export function Header() {
  const theme = useTheme();

  return (
    <header 
      className="w-full bg-white border-b-2 border-purple-200 shadow-sm"
      style={{ backgroundColor: theme.colors.background }}
    >
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <Link 
            href="/" 
            className="text-2xl font-bold font-primary bg-gradient-to-r from-purple-700 via-indigo-700 to-purple-700 bg-clip-text text-transparent hover:from-purple-600 hover:via-indigo-600 transition-all duration-300"
          >
            House of Spells
          </Link>
          
          <nav className="flex items-center space-x-6">
            <Link 
              href="/products" 
              className="text-purple-700 hover:text-amber-600 font-medium font-secondary transition-colors duration-300"
            >
              Products
            </Link>
            <Link 
              href="/fandoms" 
              className="text-purple-700 hover:text-amber-600 font-medium font-secondary transition-colors duration-300"
            >
              Fandoms
            </Link>
            <Link 
              href="/cart" 
              className="text-purple-700 hover:text-amber-600 font-medium font-secondary transition-colors duration-300"
            >
              Cart
            </Link>
            <Link 
              href="/login" 
              className="px-4 py-2 bg-gradient-to-r from-purple-700 to-indigo-700 hover:from-purple-600 hover:to-indigo-600 text-white font-semibold rounded-lg transition-all duration-300 font-primary border border-amber-400/30 hover:border-amber-400/50"
            >
              Login
            </Link>
          </nav>
        </div>
      </div>
    </header>
  );
}


