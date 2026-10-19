import { create } from 'zustand';
import api from '../services/api.service';
import { encryptFile, decryptFile } from '../services/crypto.service';
import toast from 'react-hot-toast';

export const useFileStore = create((set, get) => ({
  files:      [],
  loading:    false,
  uploading:  false,
  uploadProgress: 0,
  pagination: { page: 1, limit: 20, total: 0, pages: 1 },
  error:      null,

  fetchFiles: async (page = 1) => {
    set({ loading: true, error: null });
    try {
      const { data } = await api.get(`/files?page=${page}&limit=20`);
      set({
        files:      data.data.files,
        pagination: data.data.pagination,
        loading:    false,
      });
    } catch (err) {
      set({ loading: false, error: err.response?.data?.message || 'Failed to load files.' });
    }
  },

  uploadEncryptedFile: async (file, password) => {
    set({ uploading: true, uploadProgress: 0, error: null });
    try {
      // 1. Encrypt the file on the client
      const {
        encryptedBlob,
        iv,
        salt,
        sha256Hash,
        originalName,
      } = await encryptFile(file, password, (pct) => set({ uploadProgress: Math.floor(pct * 0.8) }));

      // 2. Build multipart form data
      const formData = new FormData();
      formData.append('encryptedFile', encryptedBlob, `${file.name}.enc`);
      formData.append('originalName', originalName);
      formData.append('sha256Hash',   sha256Hash);
      formData.append('iv',           iv);
      formData.append('salt',         salt);

      // 3. Upload to server
      const { data } = await api.post('/files/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (e) => {
          const pct = Math.round((e.loaded / e.total) * 20) + 80;
          set({ uploadProgress: pct });
        },
      });

      set((state) => ({
        files:     [data.data.file, ...state.files],
        uploading: false,
        uploadProgress: 100,
      }));
      setTimeout(() => set({ uploadProgress: 0 }), 1500);
      return { success: true };
    } catch (err) {
      const message = err.response?.data?.message || err.message || 'Upload failed.';
      set({ uploading: false, uploadProgress: 0, error: message });
      return { success: false, message };
    }
  },

  downloadAndDecrypt: async (fileId, password, fileName) => {
    try {
      const response = await api.get(`/files/${fileId}/download`, {
        responseType: 'arraybuffer',
      });

      const iv           = response.headers['x-file-iv'];
      const salt         = response.headers['x-file-salt'];
      const expectedHash = response.headers['x-file-hash'];
      const origName     = response.headers['x-original-name']
        ? atob(response.headers['x-original-name'])
        : fileName;

      // Decrypt on client
      const decrypted = await decryptFile(response.data, password, iv, salt, expectedHash);

      // Trigger browser download
      const blob = new Blob([decrypted]);
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = origName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      return { success: true };
    } catch (err) {
      return { success: false, message: err.message || 'Decryption failed.' };
    }
  },

  deleteFile: async (fileId, password) => {
    try {
      // 1. Fetch the encrypted file to verify the password
      const response = await api.get(`/files/${fileId}/download`, {
        responseType: 'arraybuffer',
      });

      const iv           = response.headers['x-file-iv'];
      const salt         = response.headers['x-file-salt'];
      const expectedHash = response.headers['x-file-hash'];

      // 2. Try decrypting — throws if password is wrong
      await decryptFile(response.data, password, iv, salt, expectedHash);

      // 3. Password verified — now delete
      await api.delete(`/files/${fileId}`);
      set((state) => ({ files: state.files.filter((f) => f._id !== fileId) }));
      return { success: true };
    } catch (err) {
      // Decryption failure means wrong password
      if (err.message?.includes('decrypt') || err.message?.includes('integrity') || err.name === 'OperationError') {
        return { success: false, message: 'Wrong password. File not deleted.' };
      }
      return { success: false, message: err.response?.data?.message || 'Delete failed.' };
    }
  },
}));
