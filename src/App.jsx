import React, { lazy, Suspense } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import LoginForm from "./components/LoginForm";
import Menu from "./pages/menu";
import Tables from "./pages/tables";
import Orders from "./pages/orders";
import Bookings from "./pages/bookings";

const Dashboard = lazy(() => import("./pages/dashboard"));


function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LoginForm />} />
        <Route path="/menu" element={<Menu />} />
        <Route path="/tables" element={<Tables />} />
        <Route path="/orders" element={<Orders />} />
        <Route path="/bookings" element={<Bookings />} />
        <Route
          path="/dashboard"
          element={
            <Suspense
              fallback={
                <div className="flex min-h-screen items-center justify-center bg-cream text-espresso">
                  Loading dashboard...
                </div>
              }
            >
              <Dashboard />
            </Suspense>
          }
        />

      </Routes>
    </Router>
  );
}
export default App;
