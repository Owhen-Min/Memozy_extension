import { useState, useEffect, useCallback } from "react";
import { setAuthToken as setToken } from "./useApi";

const AUTH_TOKEN_KEY = "google_auth_token";
const USER_EMAIL_KEY = "user_email"; // 사용자 이메일 저장 키
const GOOGLE_AUTH_URL = "https://memozy.site/oauth2/authorization/google?state=mode:extension";

// URL 해시 또는 쿼리 파라미터에서 access_token 추출하는 헬퍼 함수
const extractTokenFromUrl = (url: string): string | null => {
  // Check hash first (#access_token=...)
  let match = url.match(/#.*access_token=([^&]+)/);
  if (match && match[1]) {
    return match[1];
  }
  // Check query parameters (?access_token=...)
  match = url.match(/[?&]access_token=([^&]+)/);
  if (match && match[1]) {
    return match[1];
  }
  return null;
};

function parseJwt(token: string) {
  try {
    return JSON.parse(atob(token.split(".")[1]));
  } catch (e) {
    return null;
  }
}

export const useAuth = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null); // 사용자 이메일 상태 추가
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null); // 오류 상태 추가

  // 초기 인증 상태 확인
  const checkAuthStatus = useCallback(async () => {
    setAuthLoading(true);
    setAuthError(null);
    try {
      const result = await chrome.storage.local.get([AUTH_TOKEN_KEY, USER_EMAIL_KEY]);
      if (chrome.runtime.lastError) {
        console.error("토큰 또는 이메일 확인 중 오류:", chrome.runtime.lastError);
        throw new Error("인증 상태 확인 중 오류가 발생했습니다.");
      }
      const token = result[AUTH_TOKEN_KEY];
      const email = result[USER_EMAIL_KEY];

      if (token && email) {
        // TODO: 여기서 토큰 유효성 검증 API 호출을 추가하면 더 좋습니다.
        setIsAuthenticated(true);
        setAuthToken(token);
        setUserEmail(email);
      } else {
        setIsAuthenticated(false);
        setAuthToken(null);
        setUserEmail(null);
      }
    } catch (error: any) {
      setIsAuthenticated(false);
      setAuthToken(null);
      setUserEmail(null);
      setAuthError(error.message || "인증 상태 확인 실패");
    } finally {
      setAuthLoading(false);
    }
  }, []);

  // 로그인 처리
  const login = useCallback(() => {
    setAuthLoading(true);
    setAuthError(null);
    chrome.identity.launchWebAuthFlow(
      {
        url: GOOGLE_AUTH_URL,
        interactive: true,
      },
      async (redirectUrl) => {
        if (chrome.runtime.lastError || !redirectUrl) {
          const message = chrome.runtime.lastError?.message || "리디렉션 URL 없음";
          console.error("로그인 오류:", message);
          setAuthError(
            `로그인 중 오류가 발생했습니다: ${message === "User interaction timed out." ? "팝업이 닫혔습니다." : message}`
          );
          setIsAuthenticated(false);
          setAuthToken(null);
          setUserEmail(null);
          setAuthLoading(false);
          setToken(null);
          return;
        }

        console.log("리디렉션 URL:", redirectUrl);
        const token = extractTokenFromUrl(redirectUrl);

        if (token) {
          const decodedToken = parseJwt(token);
          if (decodedToken && decodedToken.email) {
            const email = decodedToken.email;
            console.log("토큰에서 이메일 추출:", email);
            // 이메일 저장 및 상태 설정
            try {
              await chrome.storage.local.set({ [AUTH_TOKEN_KEY]: token, [USER_EMAIL_KEY]: email });
              if (chrome.runtime.lastError) {
                throw new Error("토큰 및 이메일 저장 중 오류 발생");
              }
              setIsAuthenticated(true);
              setAuthToken(token);
              setUserEmail(email);
              console.log("토큰 및 이메일 저장, 인증 성공:", email);
              setAuthError(null); // 성공 시 오류 메시지 초기화
            } catch (error: any) {
              console.error("토큰/이메일 저장 또는 사용자 정보 가져오기 오류:", error);
              setAuthError(error.message || "토큰 또는 이메일 저장 실패");
              setIsAuthenticated(false);
              setAuthToken(null);
              setUserEmail(null);
            } finally {
              setAuthLoading(false);
            }
          } else {
            console.error("리디렉션 URL에서 토큰을 찾을 수 없음:", redirectUrl);
            setAuthError("로그인 응답에서 토큰을 찾을 수 없습니다.");
            setIsAuthenticated(false);
            setAuthToken(null);
            setUserEmail(null);
            setAuthLoading(false);
          }
        }
      }
    );
  }, []);

  // 로그아웃 처리
  const logout = useCallback(async () => {
    setAuthLoading(true);
    setAuthError(null);
    try {
      await chrome.storage.local.remove([AUTH_TOKEN_KEY, USER_EMAIL_KEY]);
      if (chrome.runtime.lastError) {
        throw new Error("로그아웃 중 오류 발생");
      }
      setIsAuthenticated(false);
      setAuthToken(null);
      setUserEmail(null);
      console.log("로그아웃 성공");
    } catch (error: any) {
      console.error("로그아웃 오류:", error);
      setAuthError(error.message || "로그아웃 실패");
      // 인증 상태는 이미 false일 수 있으므로 그대로 둡니다.
    } finally {
      setAuthLoading(false);
    }
  }, []);

  // 스토리지 변경 감지 (다른 창이나 백그라운드에서의 변경 반영)
  useEffect(() => {
    const handleStorageChange = (
      changes: { [key: string]: chrome.storage.StorageChange },
      areaName: string
    ) => {
      if (areaName === "local") {
        let authChanged = false;
        if (changes[AUTH_TOKEN_KEY]) {
          console.log("Auth Token 변경 감지:", changes[AUTH_TOKEN_KEY]);
          const newToken = changes[AUTH_TOKEN_KEY].newValue;
          setAuthToken(newToken || null);
          setIsAuthenticated(!!newToken);
          authChanged = true;
        }
        if (changes[USER_EMAIL_KEY]) {
          console.log("User Email 변경 감지:", changes[USER_EMAIL_KEY]);
          const newEmail = changes[USER_EMAIL_KEY].newValue;
          setUserEmail(newEmail || null);
          // 이메일 변경 시 인증 상태도 토큰 유무에 따라 다시 설정
          setIsAuthenticated(!!(changes[AUTH_TOKEN_KEY]?.newValue || authToken));
          authChanged = true;
        }
        if (authChanged) {
          setAuthError(null); // 외부 변경 시 오류 상태 초기화
        }
      }
    };

    chrome.storage.onChanged.addListener(handleStorageChange);

    // 초기 상태 확인
    checkAuthStatus();

    return () => {
      chrome.storage.onChanged.removeListener(handleStorageChange);
    };
  }, [checkAuthStatus, authToken]); // authToken 추가

  useEffect(() => {
    if (authToken) {
      // setAuthToken(authToken); // 이 부분은 이미 authToken 상태가 업데이트 될 때 반영되므로 중복
      setToken(authToken);
    } else {
      // setAuthToken(null); // 이 부분도 중복
      setToken(null);
    }
  }, [authToken]);

  return {
    isAuthenticated,
    authToken,
    userEmail, // userEmail 반환
    authLoading,
    authError, // 오류 상태 반환
    login,
    logout,
    checkAuthStatus, // 재확인 함수 추가
  };
};
