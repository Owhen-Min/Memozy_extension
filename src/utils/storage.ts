import { CapturedItem, StorageState } from '../types';

// 기본 스토리지 상태
const defaultState: StorageState = {
  savedItems: [],
  isCapturing: false,
  isHtmlMode: false
};

// 모든 저장된 항목 가져오기
export const getSavedItems = (): Promise<CapturedItem[]> => {
  return new Promise((resolve) => {
    chrome.storage.local.get(['savedItems'], (result) => {
      resolve(result.savedItems || []);
    });
  });
};

// 캡처 상태 가져오기
export const getCapturingState = (): Promise<boolean> => {
  return new Promise((resolve) => {
    chrome.storage.local.get(['isCapturing'], (result) => {
      resolve(result.isCapturing || false);
    });
  });
};

// HTML 모드 상태 가져오기
export const getHtmlModeState = (): Promise<boolean> => {
  return new Promise((resolve) => {
    chrome.storage.local.get(['isHtmlMode'], (result) => {
      resolve(result.isHtmlMode || false);
    });
  });
};

// 모든 상태 가져오기
export const getAllState = (): Promise<StorageState> => {
  return new Promise((resolve) => {
    chrome.storage.local.get(['savedItems', 'isCapturing', 'isHtmlMode'], (result) => {
      resolve({
        savedItems: result.savedItems || defaultState.savedItems,
        isCapturing: result.isCapturing || defaultState.isCapturing,
        isHtmlMode: result.isHtmlMode || defaultState.isHtmlMode
      });
    });
  });
};

// 아이템 저장하기
export const saveItem = async (item: CapturedItem): Promise<void> => {
  const items = await getSavedItems();
  items.push(item);
  return new Promise((resolve) => {
    chrome.storage.local.set({ savedItems: items }, () => {
      resolve();
    });
  });
};

// 캡처 상태 설정하기
export const setCapturingState = (state: boolean): Promise<void> => {
  return new Promise((resolve) => {
    chrome.storage.local.set({ isCapturing: state }, () => {
      resolve();
    });
  });
};

// HTML 모드 상태 설정하기
export const setHtmlModeState = (state: boolean): Promise<void> => {
  return new Promise((resolve) => {
    chrome.storage.local.set({ isHtmlMode: state }, () => {
      resolve();
    });
  });
};

// 아이템 삭제하기
export const deleteItem = async (itemId: number): Promise<void> => {
  const items = await getSavedItems();
  const filteredItems = items.filter(item => item.id !== itemId);
  return new Promise((resolve) => {
    chrome.storage.local.set({ savedItems: filteredItems }, () => {
      resolve();
    });
  });
};

// 모든 아이템 삭제하기
export const deleteAllItems = (): Promise<void> => {
  return new Promise((resolve) => {
    chrome.storage.local.set({ savedItems: [] }, () => {
      resolve();
    });
  });
}; 