import axios from "axios";
import { useQuery, useMutation, UseQueryOptions, UseMutationOptions } from "@tanstack/react-query";

// 기본 axios 인스턴스 생성
const api = axios.create({
  baseURL: "https://memozy.site/api",
});

// 토큰을 설정하는 함수 생성
export const setAuthToken = (token: string | null) => {
  if (token) {
    const authToken = `Bearer ${token}`;
    api.defaults.headers.common["Authorization"] = authToken;
    // 로컬 스토리지에 토큰 저장
    localStorage.setItem("google_auth_token", token);
  } else {
    delete api.defaults.headers.common["Authorization"];
    localStorage.removeItem("google_auth_token");
  }
};

// 현재 토큰을 가져오는 함수
const getAuthToken = async (): Promise<string> => {
  let token = null;
  while (!token) {
    token = localStorage.getItem("google_auth_token");
    if (token) {
      token = `Bearer ${token}`;
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return token;
};

// API 요청을 위한 커스텀 훅들
export const useApiQuery = <T = unknown>(
  queryKey: string[],
  url: string,
  options?: Omit<UseQueryOptions<T, Error>, "queryKey" | "queryFn">
) => {
  return useQuery({
    queryKey: queryKey,
    queryFn: async () => {
      // 매 요청마다 localStorage에서 직접 토큰을 가져와서 사용
      const token = await getAuthToken();
      const { data } = await api.get<T>(url, {
        headers: token ? { Authorization: token } : undefined,
      });
      return data;
    },
    ...options,
  });
};

export const useApiMutation = <T = unknown, D = unknown>(
  url: string,
  options?: Omit<UseMutationOptions<T, Error, D>, "mutationFn">
) => {
  return useMutation({
    mutationFn: async (variables: D) => {
      const token = await getAuthToken();

      const { data } = await axios.post<T>(`${api.defaults.baseURL}${url}`, variables, {
        headers: token ? { Authorization: token } : undefined,
      });
      return data;
    },
    ...options,
  });
};

export default api;
