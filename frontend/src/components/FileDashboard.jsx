import { useEffect } from 'react';
import { Download, Trash2, FileText, Shield } from 'lucide-react';
import { useFileStore } from '../store/file.store';

const formatBytes = (bytes) => {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / k ** i).toFixed(1))} ${sizes[i]}`;
};

const formatDate = (dateStr) =>
  new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });

/**
 * FileDashboard — standalone component for displaying the user's file list.
 * Extracted from DashboardPage for testability.
 */
export default function FileDashboard({ onDownload, onDelete }) {
  const { files, loading, fetchFiles } = useFileStore();

  useEffect(() => {
    fetchFiles();
  }, []);

  if (loading) {
    return (
      <div data-testid="files-loading" aria-label="Loading files">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="skeleton file-skeleton-row" />
        ))}
      </div>
    );
  }

  if (files.length === 0) {
    return (
      <div data-testid="files-empty" className="empty-state">
        <Shield size={40} aria-hidden="true" />
        <p>No files yet</p>
        <p>Upload your first file.</p>
      </div>
    );
  }

  return (
    <div
      data-testid="file-list"
      className="file-list"
      role="list"
      aria-label="Your encrypted files"
    >
      {files.map((file) => (
        <div
          key={file._id}
          className="file-item"
          role="listitem"
          data-testid={`file-item-${file._id}`}
        >
          <div className="file-icon-wrap">
            <FileText size={20} />
          </div>
          <div className="file-meta">
            <p className="file-name">{file.originalName}</p>
            <div className="file-details">
              <span>{formatBytes(file.size)}</span>
              <span>·</span>
              <span>{formatDate(file.createdAt)}</span>
              <span>·</span>
              <span className="badge badge-emerald">AES-256</span>
            </div>
          </div>
          <div className="file-actions">
            <button
              id={`download-btn-${file._id}`}
              aria-label={`Download ${file.originalName}`}
              title="Decrypt and download"
              onClick={() => onDownload?.(file)}
            >
              <Download size={14} />
            </button>
            <button
              id={`delete-btn-${file._id}`}
              aria-label={`Delete ${file.originalName}`}
              title="Delete file"
              onClick={() => onDelete?.(file)}
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
