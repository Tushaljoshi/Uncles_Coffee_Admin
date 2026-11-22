import React, { useState, useEffect } from "react";
import {
  Menu,
  ChevronDown,
  Bell,
  X,
  CheckCircle,
  User,
  FileText,
  DollarSign,
  Award,
  Info,
  AlertTriangle,
  XCircle,
  Clock,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

const TopBar = ({ toggleSidebar, sticky = true }) => {
  const [showDropdown, setShowDropdown] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const location = useLocation();
  const navigate = useNavigate();

  /* ================= PAGE INFO ================= */

  const pageInfo = {
    "/dashboard": {
      title: "Analytics Dashboard",
      subtitle: "Cafe sales, menu, bookings, and payment insights",
    },
    "/menu": {
      title: "Menu Management",
      subtitle: "Manage your cafe menu and availability",
    },
    "/tables": {
      title: "Table Management",
      subtitle: "Manage seating areas and guest availability",
    },
    "/orders": {
      title: "Order Management",
      subtitle: "Track kitchen progress and customer payments",
    },
    "/bookings": {
      title: "Booking Management",
      subtitle: "Track reservations and confirm counter payments",
    },
  };


  const currentPage = pageInfo[location.pathname] || {
    title: "Admin Panel",
    subtitle: "Manage system operations",
  };

  /* ================= LOGOUT ================= */

  const handleLogout = () => {
    localStorage.clear();
    navigate("/");
  };

  return (
    <div className={`w-full bg-white border-b border-latte shadow-sm ${sticky ? "sticky top-0 z-40" : ""}`}>
      <div className="flex items-center justify-between px-4 lg:px-6 py-3">

        {/* LEFT */}
        <div className="flex items-center gap-4">
          <button
            onClick={toggleSidebar}
            aria-label="Toggle sidebar"
            className="p-2 rounded-md hover:bg-latte active:bg-latte transition"
          >
            <Menu size={22} className="text-espresso hover:text-caramel" />
          </button>

          <div>
            <h1 className="text-lg lg:text-xl font-semibold text-espresso relative">
              {currentPage.title}
            <span className="absolute left-0 -bottom-1 h-0.5 w-10 bg-caramel rounded-full"></span>
            </h1>
            <p className="hidden sm:block mt-2 text-espresso/60 text-xs lg:text-sm">
              {currentPage.subtitle}
            </p>
          </div>
        </div>

        {/* RIGHT */}
        <div className="flex items-center gap-4">

          {/* NOTIFICATIONS */}
          <div className="relative">
            {/*<button
              onClick={() => setShowNotifications(!showNotifications)}
              className="p-2 border border-latte rounded-full hover:bg-latte relative transition"
            >
              <Bell size={18} className="text-espresso hover:text-caramel" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-caramel text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-semibold">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
              </button>*/}

            {showNotifications && (
              <div className="absolute right-0 mt-3 w-80 bg-white border border-latte rounded-xl shadow-xl">
                <div className="flex justify-between items-center p-4 border-b">
                  <h2 className="text-lg font-semibold text-espresso">
                    Notifications
                  </h2>
                  <X
                    size={18}
                    onClick={() => setShowNotifications(false)}
                    className="cursor-pointer text-espresso/60 hover:text-caramel"
                  />
                </div>

                <div className="max-h-72 overflow-y-auto">
                  {loading ? (
                    <div className="flex justify-center p-6">
                      <div className="animate-spin h-6 w-6 border-b-2 border-caramel rounded-full"></div>
                    </div>
                  ) : notifications.length === 0 ? (
                    <div className="text-center p-6 text-espresso/60">
                      No notifications
                    </div>
                  ) : (
                    notifications.map((n) => (
                      <div
                        key={n._id}
                        className={`p-4 border-b cursor-pointer hover:bg-latte flex gap-3 ${!n.isRead
                          ? "bg-latte border-l-4 border-caramel"
                          : ""
                          }`}
                      >
                        <Info size={18} className="text-caramel" />
                        <div className="flex-1">
                          <p className="font-semibold text-espresso">
                            {n.title}
                          </p>
                          <p className="text-sm text-espresso/70">{n.message}</p>
                          <div className="flex items-center gap-1 text-xs text-espresso/45 mt-1">
                            <Clock size={12} />
                            {n.createdAt}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <button className="w-full py-2 text-sm text-caramel hover:bg-latte border-t font-medium">
                  Mark all as read
                </button>
              </div>
            )}
          </div>

          {/* PROFILE */}
          <div className="relative">
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              aria-label="Open admin menu"
              className="flex items-center gap-2 border border-latte rounded-full px-2 py-1 hover:bg-latte transition"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-latte text-caramel">
                <User size={17} />
              </span>
              <div className="hidden sm:block text-left">
                <p className="text-sm font-bold text-espresso tracking-wide">
                  Uncle's Coffee<span className="align-top text-md ml-0">™</span>
                </p>
                <p className="text-xs text-espresso/60">
                  Admin Panel
                </p>
              </div>
              <ChevronDown size={16} className="text-espresso/60" />
            </button>

            {showDropdown && (
              <div className="absolute right-0 mt-2 w-44 rounded-lg border border-latte bg-white py-2 shadow-lg">
                <button
                  onClick={handleLogout}
                  className="w-full px-4 py-2 text-sm text-caramel hover:bg-latte flex items-center gap-2 font-medium"
                >
                  <span className="w-2 h-2 bg-caramel rounded-full"></span>
                  Logout
                </button>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
};

export default TopBar;
