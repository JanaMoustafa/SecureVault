import { useEffect, useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText, Lock, Eye, EyeOff } from 'lucide-react';
import { useFileStore } from '../store/file.store';
import toast from 'react-hot-toast';

const formatBytes = (bytes) => {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / k ** i).toFixed(1))} ${sizes[i]}`;
};

/**
 * FileUpload — standalone component for encrypting and uploading files.
 * Extracted from DashboardPage for testability.
 */
export default function FileUpload({ onUploadSuccess }) {
  const { uploading, uploadProgress, uploadEncryptedFile } = useFileStore();
  const [pendingFile, setPendingFile]   = useState(null);
  const [password, setPassword]         = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const onDrop = useCallback((accepted) => {
    if (accepted.length) setPendingFile(accepted[0]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: false,
    maxSize: 100 * 1024 * 1024,
  });

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!pendingFile || !password) {
      toast.error('Select a file and enter your password.');
      return;
    }
    const result = await uploadEncryptedFile(pendingFile, password);
    if (result.success) {
      toast.success(`"${pendingFile.name}" encrypted and uploaded!`);
      setPendingFile(null);
      setPassword('');
      onUploadSuccess?.();
    } else {
      toast.error(result.message);
    }
  };

  return (
    <section aria-label="Upload file" data-testid="file-upload">
      {/* Dropzone */}
      <div
        {...getRootProps()}
        className={`dropzone ${isDragActive ? 'dropzone-active' : ''} ${pendingFile ? 'dropzone-has-file' : ''}`}
        id="file-dropzone"
        aria-label="Drop files here or click to select"
      >
        <input {...getInputProps()} id="file-input" />
        {pendingFile ? (
          <div className="dropzone-file">
            <FileText size={32} />
            <div>
              <p>{pendingFile.name}</p>
              <p>{formatBytes(pendingFile.size)}</p>
            </div>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setPendingFile(null); }}
            >
              Change
            </button>
          </div>
        ) : (
          <div className="dropzone-empty">
            <Upload size={28} />
            <p>{isDragActive ? 'Drop to encrypt!' : 'Drop file here or click to browse'}</p>
            <p>Max 100 MB · All formats</p>
          </div>
        )}
      </div>

      {/* Upload Form */}
      <form onSubmit={handleUpload} aria-label="upload-form">
        <div className="form-group">
          <label htmlFor="upload-password">
            <Lock size={12} /> Encryption Password
          </label>
          <div className="input-wrapper">
            <input
              id="upload-password"
              type={showPassword ? 'text' : 'password'}
              placeholder="Enter your password to encrypt"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              aria-label="Encryption Password"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label="Toggle password visibility"
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        {uploading && (
          <div className="upload-progress" data-testid="upload-progress">
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${uploadProgress}%` }} />
            </div>
            <span>{uploadProgress < 80 ? 'Encrypting…' : 'Uploading…'} {uploadProgress}%</span>
          </div>
        )}

        <button
          type="submit"
          disabled={uploading || !pendingFile || !password}
          id="upload-submit-btn"
          aria-label="Encrypt and Upload"
        >
          {uploading ? 'Processing…' : 'Encrypt & Upload'}
        </button>
      </form>
    </section>
  );
}
