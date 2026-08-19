import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '/api';

export const mediaAPI = {
  uploadMedia: async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    
    const token = localStorage.getItem('ckr_token');
    const response = await axios.post(`${API_URL}/v2/media`, formData, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },
  
  listMedia: async () => {
    const token = localStorage.getItem('ckr_token');
    const response = await axios.get(`${API_URL}/v2/media`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
  },
  
  deleteMedia: async (filename) => {
    const token = localStorage.getItem('ckr_token');
    const response = await axios.delete(`${API_URL}/v2/media/${filename}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
  }
};
