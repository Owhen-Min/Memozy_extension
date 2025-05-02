import axios from 'axios';
import { 
  useQuery, 
  useMutation, 
  UseQueryOptions, 
  UseMutationOptions 
} from '@tanstack/react-query';

// 기본 axios 인스턴스 생성
const api = axios.create({
  baseURL: 'https://memozy.site/api',
});

// 토큰을 설정하는 함수 생성
export const setAuthToken = (token: string | null) => {
  if (token) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common['Authorization'];
  }
};

// API 요청을 위한 커스텀 훅들
export const useApiQuery = <T = unknown>(
  queryKey: string[],
  url: string,
  options?: Omit<UseQueryOptions<T, Error>, 'queryKey' | 'queryFn'>
) => {
  return useQuery({
    queryKey,
    queryFn: async () => {
      const { data } = await api.get<T>(url);
      return data;
    },
    ...options,
  });
};

export const useApiMutation = <T = unknown, D = unknown>(
  url: string,
  options?: Omit<UseMutationOptions<T, Error, D>, 'mutationFn'>
) => {
  return useMutation({
    mutationFn: async (variables: D) => {
      const { data } = await api.post<T>(url, variables);
      return data;
    },
    ...options,
  });
};

export default api;
