/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Route, Routes } from "react-router-dom";
import Home from "./pages/Home";
import StudyTracker from "./pages/StudyTracker";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/tracker" element={<StudyTracker />} />
      </Routes>
    </BrowserRouter>
  );
}
