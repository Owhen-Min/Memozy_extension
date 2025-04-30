import axios from 'axios';

const api = axios.create({
  baseURL: 'https://memozy.site/api',
});

export default api;
