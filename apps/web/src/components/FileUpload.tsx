'use client';

import { useState, useRef } from 'react';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';
import Image from 'next/image';

interface FileUploadProps {
  onUploadComplete?: (url: string) => void;
  onUploadMultipleComplete?: (urls: string[]) => void;
  multiple?: boolean;
  accept?: string;
  maxSize?: number; // in MB
  folder?: string;
}

export function FileUpload({
  onUploadComplete,
  onUploadMultipleComplete,
  multiple = false,
  accept = 'image/*',
  maxSize = 5,
  folder = 'uploads',
}: FileUploadProps) {
  const toast = useToast();
  const [uploading, setUploading] = useState(false);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // Validate file sizes
    const oversizedFiles = Array.from(files).filter(file => file.size > maxSize * 1024 * 1024);
    if (oversizedFiles.length > 0) {
      toast.error(`Some files exceed ${maxSize}MB limit`);
      return;
    }

    try {
      setUploading(true);

      if (multiple) {
        const response = await apiClient.uploadMultipleFiles(Array.from(files), folder || 'uploads');

        if (response?.data?.urls) {
          setPreviewUrls(response.data.urls);
          if (onUploadMultipleComplete) {
            onUploadComplete?.(response.data.urls[0]);
            onUploadMultipleComplete(response.data.urls);
          }
          toast.success(`${response.data.urls.length} file(s) uploaded successfully!`);
        }
      } else {
        const file = files[0];
        const response = await apiClient.uploadSingleFile(file, folder || 'uploads');

        if (response?.data?.url) {
          setPreviewUrls([response.data.url]);
          if (onUploadComplete) {
            onUploadComplete(response.data.url);
          }
          toast.success('File uploaded successfully!');
        }
      }
    } catch (err: any) {
      console.error('Upload error:', err);
      toast.error(err.message || 'Failed to upload file(s)');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemove = (index: number) => {
    setPreviewUrls(urls => urls.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-4">
      <div>
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={handleFileChange}
          disabled={uploading}
          className="hidden"
          id="file-upload"
        />
        <label
          htmlFor="file-upload"
          className={`inline-block px-6 py-3 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-purple-500 transition-colors ${
            uploading ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        >
          {uploading ? (
            <span className="flex items-center gap-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-600"></div>
              Uploading...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              📤 {multiple ? 'Choose Files' : 'Choose File'} (Max {maxSize}MB)
            </span>
          )}
        </label>
      </div>

      {previewUrls.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {previewUrls.map((url, index) => (
            <div key={index} className="relative group">
              {accept.startsWith('image/') ? (
                <div className="relative w-full h-32 rounded-lg overflow-hidden border border-gray-200">
                  <Image
                    src={url}
                    alt={`Preview ${index + 1}`}
                    fill
                    className="object-cover"
                  />
                  <button
                    onClick={() => handleRemove(index)}
                    className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    ×
                  </button>
                </div>
              ) : (
                <div className="w-full h-32 rounded-lg border border-gray-200 flex items-center justify-center bg-gray-50">
                  <div className="text-center">
                    <p className="text-sm text-gray-600">File uploaded</p>
                    <button
                      onClick={() => handleRemove(index)}
                      className="mt-2 text-sm text-red-600 hover:text-red-800"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
