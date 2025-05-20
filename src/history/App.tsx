import { Routes, Route } from "react-router";
import History from "./History";
import SummaryView from "./views/SummaryView";
import ProblemView from "./views/ProblemView";
import { QueryProvider } from "../providers/QueryProvider";
import GlobalModal from "./features/GlobalModal";
import { ModalProvider } from "../context/ModalContext";

function App() {
  return (
    <QueryProvider>
      <ModalProvider>
        <GlobalModal />
        <Routes>
          <Route path="/" element={<History />} />
          <Route path="/summary/:summaryId" element={<SummaryView />} />
          <Route path="/problem/:problemId" element={<ProblemView />} />
        </Routes>
      </ModalProvider>
    </QueryProvider>
  );
}

export default App;
