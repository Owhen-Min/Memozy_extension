import { createContext, useContext, useState, ReactNode } from "react";

type ModalContextType = {
  isOpen: boolean;
  content: ReactNode;
  isCloseable: boolean;
  openModal: (content: ReactNode, options?: { closeable?: boolean }) => void;
  closeModal: () => void;
};

const ModalContext = createContext<ModalContextType | undefined>(undefined);

export const ModalProvider = ({ children }: { children: ReactNode }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [content, setContent] = useState<ReactNode>(null);
  const [isCloseable, setIsCloseable] = useState(true);

  const openModal = (modalContent: ReactNode, options?: { closeable?: boolean }) => {
    setContent(modalContent);
    setIsCloseable(options?.closeable ?? true);
    setIsOpen(true);
  };

  const closeModal = () => {
    setIsOpen(false);
    setContent(null);
  };

  return (
    <ModalContext.Provider value={{ isOpen, content, isCloseable, openModal, closeModal }}>
      {children}
    </ModalContext.Provider>
  );
};

export const useModal = () => {
  const context = useContext(ModalContext);
  if (!context) {
    throw new Error("useModal must be used within a ModalProvider");
  }
  return context;
};
