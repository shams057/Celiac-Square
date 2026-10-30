import axios from 'axios';

const API_BASE = '/api';

export const fetchSpots = async (filters = {}) => {
  const params = new URLSearchParams();
  if (filters.category && filters.category !== 'ALL') params.append('category', filters.category);
  if (filters.city && filters.city !== 'ALL') params.append('city', filters.city);
  if (filters.isVerified !== undefined && filters.isVerified !== '') params.append('isVerified', filters.isVerified);
  if (filters.q) params.append('q', filters.q);

  const res = await axios.get(`${API_BASE}/map/spots?${params.toString()}`);
  return res.data;
};

export const fetchCities = async () => {
  const res = await axios.get(`${API_BASE}/map/cities`);
  return res.data;
};

export const submitSpot = async (spotData) => {
  const res = await axios.post(`${API_BASE}/map/spots`, spotData);
  return res.data;
};

export const searchProducts = async (query = '') => {
  const res = await axios.get(`${API_BASE}/products/search?q=${encodeURIComponent(query)}`);
  return res.data;
};

export const fetchProductByBarcode = async (barcode) => {
  const res = await axios.get(`${API_BASE}/products/barcode/${encodeURIComponent(barcode)}`);
  return res.data;
};

export const identifyProductVision = async (imageFile) => {
  const formData = new FormData();
  formData.append('image', imageFile);

  const res = await axios.post(`${API_BASE}/vision/identify`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    timeout: 30000,
  });
  return res.data;
};
