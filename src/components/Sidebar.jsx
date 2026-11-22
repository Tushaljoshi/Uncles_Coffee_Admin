import { useNavigate, useLocation } from "react-router-dom";
import {
  Activity,
  CalendarDays,
  ClipboardList,
  Coffee,
  MapPin,
} from "lucide-react";
const Sidebar = ({ isOpen, toggleSidebar }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const menu = [
    {
      section: "Cafe management",
      items: [
        { label: "Dashboard", icon: Activity, path: "/dashboard" },
        { label: "Menu", icon: Coffee, path: "/menu" },
        { label: "Tables", icon: MapPin, path: "/tables" },
        { label: "Orders", icon: ClipboardList, path: "/orders" },
        { label: "Bookings", icon: CalendarDays, path: "/bookings" },
      ],
    },
  ];

  const handleNavigation = (path) => {
    navigate(path);
    toggleSidebar();
  };

  return (
    <div
      className={`fixed top-0 left-0 h-full w-60 sm:w-64 lg:w-60 bg-white shadow-xl border-r border-latte
      transform transition-all duration-300 z-50
      ${isOpen ? "translate-x-0" : "-translate-x-full"}
      lg:translate-x-0`}
    >
      {/* HEADER */}
      <div className="flex items-center justify-between px-4 sm:px-5 py-4 border-b">
        <div className="flex items-center gap-2">
          <div className="hidden sm:block">
            <h1 className="text-md font-bold text-espresso tracking-wide">
              Uncle's Coffee<span className="align-top text-md ml-0">™</span>
            </h1>
            <p className="text-[10px] text-espresso/60 -mt-1">
              Admin Panel
            </p>
          </div>
        </div>
        <button
          className="text-espresso text-lg hover:text-caramel hover:bg-latte p-1 rounded transition-colors lg:hidden"
          onClick={toggleSidebar}
        >
          ✕
        </button>
      </div>

      {/* MENU */}
      <div className="px-4 py-3 overflow-y-auto h-[calc(100%-70px)]">
        {menu.map((section, index) => (
          <div key={index} className="mb-5">
            <p className="uppercase text-[11px] text-espresso/50 font-semibold mb-2">
              {section.section}
            </p>

            <div className="space-y-[2px]">
              {section.items.map((item, i) => {
                const active = location.pathname === item.path;

                return (
                  <button
                    key={i}
                    onClick={() => handleNavigation(item.path)}
                    className={`flex items-center gap-3 w-full px-2 sm:px-3 py-2
                      rounded-md text-xs sm:text-sm transition-all
                      ${active
                        ? "bg-caramel text-white font-medium shadow-sm"
                        : "text-espresso hover:bg-latte hover:text-caramel"
                      }`}
                  >
                    <item.icon size={16} />
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Sidebar;
