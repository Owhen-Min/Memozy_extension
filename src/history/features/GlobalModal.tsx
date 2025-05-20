import ReactDOM from "react-dom";
import { useState, useEffect } from "react";
import { useModal } from "../../context/ModalContext";

const GlobalModal = () => {
  const { isOpen, content, closeModal, isCloseable } = useModal();
  const [visible, setVisible] = useState(false);

  // 모달이 열릴 때 보이기 시작
  useEffect(() => {
    if (isOpen) setVisible(true);
  }, [isOpen]);

  const handleOutsideClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && isCloseable) {
      handleClose();
    }
  };
  const handleClose = () => {
    // 트랜지션 종료 후 실제로 제거
    setVisible(false);
    setTimeout(() => {
      closeModal();
    }, 300); // duration-300과 동일
  };

  if (!isOpen) return null;

  return ReactDOM.createPortal(
    <div
      className={`fixed inset-0 z-50 bg-black/50 flex items-center justify-center transition-opacity duration-300 ease-in-out ${
        visible ? "opacity-100" : "opacity-0"
      }`}
      onClick={handleOutsideClick}
    >
      <div onClick={(e) => e.stopPropagation()}>{content}</div>
    </div>,
    document.body
  );
};

export default GlobalModal;
