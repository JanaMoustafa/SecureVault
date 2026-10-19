import { useEffect, useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import {
  Upload, Files, Shield, Lock, Download, Trash2,
  CheckCircle, FileText, HardDrive, Eye, EyeOff, X,
} from 'lucide-react';
import { useFileStore } from '../store/file.store';
import { useAuthStore } from '../store/auth.store';
import toast from 'react-hot-toast';
import '../styles/dashboard.css';

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

// ── Password Modal ────────────────────────────────────────────
function PasswordModal({ file, action, onConfirm, onClose, loading }) {
  const [pwd, setPwd] = useState('');
  const [show, setShow] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!pwd) return;
    onConfirm(pwd);
  };

  const isDelete = action === 'delete';

  return (
    <div
      className="modal-backdrop"
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div
        className="glass-card"
        onClick={(e) => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 400, padding: '2rem', position: 'relative' }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
        >
          <X size={18} />
        </button>

        {/* Icon + Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
          <div className={`stat-icon ${isDelete ? 'stat-icon-red' : 'stat-icon-emerald'}`} style={{ width: 40, height: 40 }}>
            {isDelete ? <Trash2 size={18} /> : <Download size={18} />}
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              {isDelete ? 'Confirm Delete' : 'Decrypt & Download'}
            </h3>
            <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              {file.originalName}
            </p>
          </div>
        </div>

        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
          {isDelete
            ? 'Enter the file password to verify ownership before deleting.'
            : 'Enter the file password to decrypt and download.'}
        </p>

        <form onSubmit={handleSubmit}>
          <div className="form-group" style={{ marginBottom: '1.25rem' }}>
            <label className="form-label" htmlFor="modal-password">
              <Lock size={12} /> File Password
            </label>
            <div className="input-wrapper">
              <input
                id="modal-password"
                type={show ? 'text' : 'password'}
                placeholder="Enter your encryption password"
                className="form-input input-with-end-icon"
                value={pwd}
                onChange={(e) => setPwd(e.target.value)}
                autoFocus
                required
              />
              <button
                type="button"
                className="input-end-btn"
                onClick={() => setShow((v) => !v)}
                aria-label="Toggle password visibility"
              >
                {show ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={onClose}
              style={{ flex: 1 }}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={`btn btn-sm ${isDelete ? 'btn-danger' : 'btn-success'}`}
              style={{ flex: 1 }}
              disabled={!pwd || loading}
              id="modal-confirm-btn"
            >
              {loading
                ? <><span className="spinner" />{isDelete ? 'Verifying…' : 'Decrypting…'}</>
                : isDelete ? <><Trash2 size={14} /> Delete</> : <><Download size={14} /> Download</>
              }
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main Dashboard ────────────────────────────────────────────
export default function DashboardPage() {
  const { user } = useAuthStore();
  const { files, loading, uploading, uploadProgress, fetchFiles, uploadEncryptedFile, downloadAndDecrypt, deleteFile } = useFileStore();

  const [pendingFile, setPendingFile] = useState(null);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Modal state
  const [modal, setModal] = useState(null); // { file, action: 'download'|'delete' }
  const [modalLoading, setModalLoading] = useState(false);

  useEffect(() => { fetchFiles(); }, []);

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
    } else {
      toast.error(result.message);
    }
  };

  const handleModalConfirm = async (pwd) => {
    if (!modal) return;
    setModalLoading(true);

    if (modal.action === 'download') {
      const toastId = toast.loading('Decrypting…');
      const result = await downloadAndDecrypt(modal.file._id, pwd, modal.file.originalName);
      toast.dismiss(toastId);
      if (result.success) {
        toast.success('File decrypted and downloaded!');
        setModal(null);
      } else {
        toast.error(result.message);
      }
    }

    if (modal.action === 'delete') {
      const toastId = toast.loading('Verifying password…');
      const result = await deleteFile(modal.file._id, pwd);
      toast.dismiss(toastId);
      if (result.success) {
        toast.success('File deleted.');
        setModal(null);
      } else {
        toast.error(result.message);
      }
    }

    setModalLoading(false);
  };

  const totalSize = files.reduce((acc, f) => acc + (f.size || 0), 0);

  return (
    <div className="dashboard animate-fade-in">

      {/* ── Password Modal ───────────────────────────────── */}
      {modal && (
        <PasswordModal
          file={modal.file}
          action={modal.action}
          onConfirm={handleModalConfirm}
          onClose={() => !modalLoading && setModal(null)}
          loading={modalLoading}
        />
      )}

      {/* ── Header ───────────────────────────────────────── */}
      <header className="dashboard-header">
        <div>
          <h1 className="page-title">
            <Shield size={24} className="title-icon" />
            My Encrypted Vault
          </h1>
          <p className="page-subtitle">Files are encrypted on your device before upload. The server sees only ciphertext.</p>
        </div>
      </header>

      {/* ── Stats Row ───────────────────────────────────── */}
      <div className="stats-row">
        <div className="glass-card stat-card">
          <div className="stat-icon stat-icon-indigo"><Files size={20} /></div>
          <div>
            <p className="stat-label">Encrypted Files</p>
            <p className="stat-value">{files.length}</p>
          </div>
        </div>
        <div className="glass-card stat-card">
          <div className="stat-icon stat-icon-emerald"><HardDrive size={20} /></div>
          <div>
            <p className="stat-label">Storage Used</p>
            <p className="stat-value">{formatBytes(totalSize)}</p>
          </div>
        </div>
        <div className="glass-card stat-card">
          <div className="stat-icon stat-icon-amber"><Lock size={20} /></div>
          <div>
            <p className="stat-label">Encryption</p>
            <p className="stat-value" style={{ fontSize: '0.9rem' }}>AES-256-GCM</p>
          </div>
        </div>
        <div className="glass-card stat-card">
          <div className="stat-icon stat-icon-purple"><Shield size={20} /></div>
          <div>
            <p className="stat-label">Key Derivation</p>
            <p className="stat-value" style={{ fontSize: '0.9rem' }}>PBKDF2</p>
          </div>
        </div>
      </div>

      <div className="dashboard-grid">
        {/* ── Upload Panel ───────────────────────────────── */}
        <section className="glass-card upload-panel" aria-label="Upload file">
          <div className="panel-header">
            <Upload size={20} />
            <h2 className="panel-title">Encrypt &amp; Upload</h2>
          </div>

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
                <FileText size={32} className="dz-file-icon" />
                <div>
                  <p className="dz-file-name">{pendingFile.name}</p>
                  <p className="dz-file-size">{formatBytes(pendingFile.size)}</p>
                </div>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={(e) => { e.stopPropagation(); setPendingFile(null); }}
                >
                  Change
                </button>
              </div>
            ) : (
              <div className="dropzone-empty">
                <div className="dz-upload-icon"><Upload size={28} /></div>
                <p className="dz-label">{isDragActive ? 'Drop to encrypt!' : 'Drop file here or click to browse'}</p>
                <p className="dz-sublabel">Max 100 MB · All formats</p>
              </div>
            )}
          </div>

          <form onSubmit={handleUpload} className="upload-form">
            <div className="form-group">
              <label className="form-label" htmlFor="upload-password">
                <Lock size={12} /> Encryption Password
              </label>
              <div className="input-wrapper">
                <input
                  id="upload-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password to encrypt"
                  className="form-input input-with-end-icon"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="input-end-btn"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label="Toggle password visibility"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {uploading && (
              <div className="upload-progress">
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${uploadProgress}%` }} />
                </div>
                <span className="progress-label">{uploadProgress < 80 ? 'Encrypting…' : 'Uploading…'} {uploadProgress}%</span>
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%' }}
              disabled={uploading || !pendingFile || !password}
              id="upload-submit-btn"
            >
              {uploading ? (
                <><span className="spinner" />Processing…</>
              ) : (
                <><Lock size={16} />Encrypt &amp; Upload</>
              )}
            </button>
          </form>

          <div className="security-info-box">
            <CheckCircle size={14} className="sib-icon" />
            <p>Encrypted locally with AES-256-GCM before transmission. Server stores only ciphertext.</p>
          </div>
        </section>

        {/* ── File List ──────────────────────────────────── */}
        <section className="files-panel" aria-label="Your files">
          <div className="panel-header" style={{ marginBottom: '1rem' }}>
            <Files size={20} />
            <h2 className="panel-title">Your Encrypted Files</h2>
            <span className="badge badge-indigo" style={{ marginLeft: 'auto' }}>{files.length} files</span>
          </div>

          {loading ? (
            <div className="files-skeleton">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="skeleton file-skeleton-row" />
              ))}
            </div>
          ) : files.length === 0 ? (
            <div className="empty-state">
              <Shield size={40} className="empty-icon" />
              <p className="empty-title">No files yet</p>
              <p className="empty-sub">Upload your first file.</p>
            </div>
          ) : (
            <div className="file-list" role="list">
              {files.map((file) => (
                <div key={file._id} className="glass-card file-item" role="listitem">
                  <div className="file-icon-wrap">
                    <FileText size={20} />
                  </div>
                  <div className="file-meta">
                    <p className="file-name">{file.originalName}</p>
                    <div className="file-details">
                      <span>{formatBytes(file.size)}</span>
                      <span className="dot">·</span>
                      <span>{formatDate(file.createdAt)}</span>
                      <span className="dot">·</span>
                      <span className="badge badge-emerald">AES-256</span>
                    </div>
                  </div>
                  <div className="file-actions">
                    <button
                      className="btn btn-success btn-sm"
                      onClick={() => setModal({ file, action: 'download' })}
                      id={`download-btn-${file._id}`}
                      title="Decrypt and download"
                    >
                      <Download size={14} />
                    </button>
                    <button
                      className="btn btn-danger btn-sm icon-btn"
                      onClick={() => setModal({ file, action: 'delete' })}
                      id={`delete-btn-${file._id}`}
                      title="Delete file"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
