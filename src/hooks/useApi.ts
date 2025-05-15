import axios from "axios";
import { useQuery, useMutation, UseQueryOptions, UseMutationOptions } from "@tanstack/react-query";
import { useState, useEffect } from "react";

// 기본 axios 인스턴스 생성
const api = axios.create({
  baseURL: "https://memozy.site/api",
});

// 토큰 저장소
let authToken: string | null = null;

// 토큰 상태를 추적하는 훅
export const useAuthToken = () => {
  const [isTokenSet, setIsTokenSet] = useState(!!authToken);

  useEffect(() => {
    // 로컬 스토리지에서 토큰 가져오기
    const token = localStorage.getItem("google_auth_token");
    if (token) {
      setAuthToken(token);
      setIsTokenSet(true);
    }
  }, []);

  console.log(authToken);
  console.log(api.defaults.headers);

  return isTokenSet;
};

// // 인터셉터 추가
// api.interceptors.request.use((request) => {
//   console.log("인터셉터 내 authToken:", authToken);
//   // 요청 직전에 토큰이 있으면 항상 헤더에 추가
//   if (authToken) {
//     request.headers.Authorization = authToken;
//   }
//   return request;
// });

// 토큰을 설정하는 함수 생성
export const setAuthToken = (token: string | null) => {
  if (token) {
    authToken = `Bearer ${token}`;
    api.defaults.headers.common["Authorization"] = authToken;
    console.log("토큰 설정됨:", authToken);
    // 로컬 스토리지에 토큰 저장
    localStorage.setItem("token", token);
  } else {
    authToken = null;
    delete api.defaults.headers.common["Authorization"];
    localStorage.removeItem("token");
  }
};

// API 요청을 위한 커스텀 훅들
export const useApiQuery = <T = unknown>(
  queryKey: string[],
  url: string,
  options?: Omit<UseQueryOptions<T, Error>, "queryKey" | "queryFn">
) => {
  const isTokenSet = useAuthToken();
  console.log(api.defaults.headers);
  console.log(
    "useApiQuery 내부 Authorization:",
    api.defaults.headers.common["Authorization"],
    "토큰설정여부:",
    isTokenSet
  );

  return useQuery({
    queryKey: queryKey,
    queryFn: async () => {
      console.log("도은코치가 고쳐줄게 ");
      console.log(api.defaults.headers.common);

      console.log("요청 직전 헤더:");
      console.log(api.defaults.headers.common["Authorization"]);
      const { data } = await api.get<T>(url);

      return data;
    },
    ...options,
    // 이미 enabled 옵션이 있으면 그것과 토큰 설정 여부를 함께 고려
    enabled: isTokenSet && options?.enabled !== false,
  });
};

export const useApiMutation = <T = unknown, D = unknown>(
  url: string,
  options?: Omit<UseMutationOptions<T, Error, D>, "mutationFn">
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
