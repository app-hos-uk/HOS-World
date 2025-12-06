'use client';

import { useState } from 'react';
import { RouteGuard } from '@/components/RouteGuard';
import { AdminLayout } from '@/components/AdminLayout';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';

export default function AdminMigrationPage() {
  const toast = useToast();
  const [running, setRunning] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [migrationResult, setMigrationResult] = useState<any>(null);
  const [verificationResult, setVerificationResult] = useState<any>(null);

  const handleRunMigration = async () => {
    if (!confirm('Are you sure you want to run the global features migration? This will modify the database schema.')) {
      return;
    }

    setRunning(true);
    setMigrationResult(null);

    try {
      const response = await apiClient.runGlobalFeaturesMigration();
      const result = response.data || response;
      setMigrationResult(result);
      
      if (result.success) {
        toast.success('Migration completed successfully!');
      } else {
        toast.error(result.message || 'Migration failed');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to run migration');
      setMigrationResult({ success: false, error: error.message });
    } finally {
      setRunning(false);
    }
  };

  const handleVerify = async () => {
    setVerifying(true);
    setVerificationResult(null);

    try {
      const response = await apiClient.verifyMigration();
      const result = response.data || response;
      setVerificationResult(result);
      
      if (result.success) {
        toast.success('Verification completed');
      } else {
        toast.error('Verification failed');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to verify migration');
      setVerificationResult({ success: false, error: error.message });
    } finally {
      setVerifying(false);
    }
  };

  return (
    <RouteGuard allowedRoles={['ADMIN']} showAccessDenied={true}>
      <AdminLayout>
        <div className="p-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-6">Database Migration</h1>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <h2 className="text-lg font-semibold text-yellow-800 mb-2">⚠️ Important</h2>
            <p className="text-yellow-700">
              This will run the global features migration, which adds new columns and tables to the database.
              Make sure you have a database backup before proceeding.
            </p>
          </div>

          <div className="space-y-6">
            {/* Run Migration Section */}
            <div className="bg-white border rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">Run Global Features Migration</h2>
              <p className="text-gray-600 mb-4">
                This migration will:
              </p>
              <ul className="list-disc list-inside text-gray-600 mb-4 space-y-1">
                <li>Add new columns to users table (country, WhatsApp, GDPR fields, etc.)</li>
                <li>Add new columns to customers table</li>
                <li>Create currency_exchange_rates table</li>
                <li>Create gdpr_consent_logs table</li>
                <li>Update currency defaults to GBP</li>
                <li>Create Prisma migrations table and baseline</li>
              </ul>
              
              <button
                onClick={handleRunMigration}
                disabled={running}
                className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium transition-colors"
              >
                {running ? 'Running Migration...' : 'Run Migration'}
              </button>

              {migrationResult && (
                <div className={`mt-4 p-4 rounded-lg ${migrationResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                  <h3 className={`font-semibold mb-2 ${migrationResult.success ? 'text-green-800' : 'text-red-800'}`}>
                    {migrationResult.success ? '✅ Migration Successful' : '❌ Migration Failed'}
                  </h3>
                  {migrationResult.summary && (
                    <div className="text-sm text-gray-700 mb-2">
                      <p>Total Statements: {migrationResult.summary.totalStatements}</p>
                      <p>Successful: {migrationResult.summary.successful}</p>
                      <p>Errors: {migrationResult.summary.errors}</p>
                    </div>
                  )}
                  {migrationResult.verification && (
                    <div className="text-sm text-gray-700">
                      <p>Country Column Exists: {migrationResult.verification.countryColumnExists ? '✅' : '❌'}</p>
                    </div>
                  )}
                  {migrationResult.error && (
                    <p className="text-sm text-red-700 mt-2">{migrationResult.error}</p>
                  )}
                  <pre className="mt-2 text-xs bg-gray-100 p-2 rounded overflow-auto max-h-40">
                    {JSON.stringify(migrationResult, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            {/* Verify Migration Section */}
            <div className="bg-white border rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">Verify Migration</h2>
              <p className="text-gray-600 mb-4">
                Check if the migration was applied successfully.
              </p>
              
              <button
                onClick={handleVerify}
                disabled={verifying}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium transition-colors"
              >
                {verifying ? 'Verifying...' : 'Verify Migration'}
              </button>

              {verificationResult && (
                <div className={`mt-4 p-4 rounded-lg ${verificationResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                  <h3 className={`font-semibold mb-2 ${verificationResult.success ? 'text-green-800' : 'text-red-800'}`}>
                    {verificationResult.success ? '✅ Verification Results' : '❌ Verification Failed'}
                  </h3>
                  {verificationResult.usersColumns && (
                    <div className="text-sm text-gray-700 mb-2">
                      <p className="font-medium">Users Columns Found:</p>
                      <ul className="list-disc list-inside ml-4">
                        {verificationResult.usersColumns.map((col: string) => (
                          <li key={col}>{col}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {verificationResult.newTables && (
                    <div className="text-sm text-gray-700 mb-2">
                      <p className="font-medium">New Tables Found:</p>
                      <ul className="list-disc list-inside ml-4">
                        {verificationResult.newTables.map((table: string) => (
                          <li key={table}>{table}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {verificationResult.migrationsTableExists !== undefined && (
                    <div className="text-sm text-gray-700 mb-2">
                      <p>Prisma Migrations Table: {verificationResult.migrationsTableExists ? '✅ Exists' : '❌ Missing'}</p>
                    </div>
                  )}
                  {verificationResult.allColumnsPresent !== undefined && (
                    <div className="text-sm text-gray-700 mb-2">
                      <p>All Required Columns Present: {verificationResult.allColumnsPresent ? '✅ Yes' : '❌ No'}</p>
                    </div>
                  )}
                  {verificationResult.error && (
                    <p className="text-sm text-red-700 mt-2">{verificationResult.error}</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </AdminLayout>
    </RouteGuard>
  );
}

