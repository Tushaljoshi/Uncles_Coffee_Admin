import React from "react";

const Toast = ({ toasts }) => {
  return (
    <>
      <div className="fixed top-4 right-4 z-[9999] space-y-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`animate-slide-in-right px-4 py-3 rounded-lg shadow-lg text-white text-sm font-medium min-w-64 ${
              toast.type === "error"
                ? "bg-error"
                : toast.type === "success"
                ? "bg-success"
                : toast.type === "warning"
                ? "bg-warning"
                : "bg-terracotta"
            }`}
          >
            {toast.message}
          </div>
        ))}
      </div>
      <style>{`
        @keyframes slideInRight {
          from {
            transform: translateX(400px);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        .animate-slide-in-right {
          animation: slideInRight 0.4s ease-out;
        }
      `}</style>
    </>
  );
};

export default Toast;
