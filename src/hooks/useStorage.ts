import { useState, useEffect, useCallback } from "react";
import { CapturedItem } from "../types";
import * as StorageUtils from "../utils/storage";

export const useStorage = () => {
  const [savedItems, setSavedItems] = useState<CapturedItem[]>([]);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isHtmlMode, setIsHtmlMode] = useState(false);
  const [loading, setLoading] = useState(true);

  // 모든 상태 로드
  const loadAllState = useCallback(async () => {
    setLoading(true);
    try {
      const state = await StorageUtils.getAllState();
      setSavedItems(state.savedItems);
      setIsCapturing(state.isCapturing);
      setIsHtmlMode(state.isHtmlMode);
    } catch (error) {
      console.error("상태 로드 중 오류:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  // 캡처 상태 토글
  const toggleCapturing = useCallback(async () => {
    const newState = !isCapturing;
    try {
      await StorageUtils.setCapturingState(newState);
      setIsCapturing(newState);

      // 현재 활성 탭에 상태 변경 알림
      try {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tabs.length > 0 && tabs[0].id) {
          try {
            await chrome.tabs.sendMessage(tabs[0].id!, {
              action: newState ? "startCapture" : "stopCapture",
              isCapturing: newState,
            });
          } catch (error) {
            console.warn("콘텐츠 스크립트에 메시지 전송 실패:", error);
          }
        }
      } catch (error) {
        console.error("탭 조회 오류:", error);
      }
    } catch (error) {
      console.error("캡처 상태 변경 중 오류:", error);
    }
  }, [isCapturing]);

  // HTML 모드 토글
  const toggleHtmlMode = useCallback(async () => {
    const newState = !isHtmlMode;
    try {
      await StorageUtils.setHtmlModeState(newState);
      setIsHtmlMode(newState);

      // 현재 활성 탭에 상태 변경 알림
      try {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tabs.length > 0 && tabs[0].id) {
          try {
            await chrome.tabs.sendMessage(tabs[0].id!, {
              action: "updateCapturingState",
              isCapturing: isCapturing,
              isHtmlMode: newState,
            });
          } catch (error) {
            // 오류가 있더라도 스토리지 상태는 이미 변경됨
          }
        }
      } catch (error) {}
    } catch (error) {}
  }, [isHtmlMode, isCapturing]);

  // HTML 저장 실행
  const saveHtml = useCallback(async () => {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs.length > 0 && tabs[0].id) {
        try {
          const response = await new Promise<any>((resolve, reject) => {
            chrome.tabs.sendMessage(tabs[0].id!, { action: "contentScriptCheck" }, (response) => {
              if (chrome.runtime.lastError) {
                console.warn("콘텐츠 스크립트 확인 오류:", chrome.runtime.lastError);
                reject(chrome.runtime.lastError);
              } else {
                resolve(response);
              }
            });

            // 3초 내에 응답이 없으면 타임아웃
            setTimeout(() => {
              reject(new Error("콘텐츠 스크립트 응답 시간 초과"));
            }, 3000);
          });

          // 연결 확인 후 저장 메시지 전송
          if (response && response.success) {
            const saveResult = await chrome.tabs.sendMessage(tabs[0].id!, {
              action: "saveFullHtml",
            });

            // 결과 확인
            if (saveResult && !saveResult.success) {
              console.error("저장 실패:", saveResult.error);
              return { success: false, error: saveResult.error || "저장 중 오류가 발생했습니다" };
            }
            return { success: true };
          } else {
            console.error("콘텐츠 스크립트 응답 실패");
            return { success: false, error: "페이지와 연결이 원활하지 않습니다" };
          }
        } catch (error: any) {
          console.error("콘텐츠 스크립트와 통신 오류:", error);
          return { success: false, error: "Memozy 페이지에서는 캡처가 불가능합니다" };
        }
      }
      return { success: false, error: "현재 활성화된 탭을 찾을 수 없습니다" };
    } catch (error: any) {
      console.error("HTML 저장 중 오류:", error);
      return { success: false, error: error.message || "HTML 저장 중 오류가 발생했습니다" };
    }
  }, []);

  // 기록 페이지 열기
  const openHistoryPage = useCallback(() => {
    chrome.tabs.create({ url: "history.html" });
  }, []);

  // 아이템 삭제
  const deleteItem = useCallback(async (itemId: number) => {
    try {
      await StorageUtils.deleteItem(itemId);
      setSavedItems((prevItems) => prevItems.filter((item) => item.id !== itemId));
    } catch (error) {
      console.error("아이템 삭제 중 오류:", error);
    }
  }, []);

  // 모든 아이템 삭제
  const deleteAllItems = useCallback(async () => {
    try {
      await StorageUtils.deleteAllItems();
      setSavedItems([]);
    } catch (error) {
      console.error("모든 아이템 삭제 중 오류:", error);
    }
  }, []);

  // 아이템 다운로드
  const downloadItem = useCallback(async (item: CapturedItem) => {
    try {
      return await chrome.runtime.sendMessage({
        action: "downloadItem",
        item: item,
      });
    } catch (error) {
      console.error("아이템 다운로드 중 오류:", error);
      return { success: false, error: "다운로드 중 오류가 발생했습니다." };
    }
  }, []);

  // 스토리지 변경 감지 설정
  useEffect(() => {
    const handleStorageChange = (
      changes: { [key: string]: chrome.storage.StorageChange },
      areaName: string
    ) => {
      if (areaName !== "local") return;

      if (changes.savedItems) {
        setSavedItems(changes.savedItems.newValue || []);
      }
      if (changes.isCapturing) {
        setIsCapturing(changes.isCapturing.newValue || false);
      }
      if (changes.isHtmlMode) {
        setIsHtmlMode(changes.isHtmlMode.newValue || false);
      }
    };

    chrome.storage.onChanged.addListener(handleStorageChange);

    // 초기 상태 로드
    loadAllState();

    return () => {
      chrome.storage.onChanged.removeListener(handleStorageChange);
    };
  }, [loadAllState]);

  return {
    savedItems,
    isCapturing,
    isHtmlMode,
    loading,
    toggleCapturing,
    toggleHtmlMode,
    saveHtml,
    openHistoryPage,
    deleteItem,
    deleteAllItems,
    downloadItem,
    loadAllState,
  };
};
