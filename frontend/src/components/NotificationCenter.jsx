import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getData, postData } from "../lib/api";
import { useAuth } from "../lib/auth";

export default function NotificationCenter() {
  const navigate = useNavigate();
  const { token, user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!token) {
      setNotifications([]);
      setUnreadCount(0);
      return undefined;
    }

    let active = true;
    const loadNotifications = async () => {
      try {
        const data = await getData("/tasks/notifications/");
        if (!active) return;
        setNotifications(Array.isArray(data?.results) ? data.results : []);
        setUnreadCount(Number(data?.unread_count) || 0);
      } catch {
        // A missing optional notification endpoint should not interrupt the workspace.
      }
    };

    loadNotifications();
    const intervalId = window.setInterval(loadNotifications, 30000);
    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [token]);

  const markAllRead = async () => {
    const unreadIds = notifications.filter((item) => !item.is_read).map((item) => item.id);
    if (!unreadIds.length) return;
    try {
      await postData("/tasks/notifications/read/", { ids: unreadIds });
      setNotifications((current) => current.map((item) => ({ ...item, is_read: true })));
      setUnreadCount(0);
    } catch {
      // Keep the current display if the request fails; it will refresh on the next poll.
    }
  };

  if (!token) return null;

  const roleText = String(user?.role || "").toLowerCase();
  const canManageWorkflows = ["owner", "admin", "manager"].some((role) => roleText.includes(role));

  return (
    <div className="fixed right-4 top-4 z-50 flex items-start gap-2">
      {canManageWorkflows ? <button type="button" className="rounded-full border border-blue-200 bg-white px-3 py-2 text-sm font-bold text-blue-900 shadow-md transition hover:bg-blue-50" onClick={() => navigate("/workflows")}>Automations</button> : null}
      <div>
      <button
        type="button"
        className="relative rounded-full border border-blue-200 bg-white px-3 py-2 text-sm font-bold text-blue-900 shadow-md transition hover:bg-blue-50"
        onClick={() => setIsOpen((value) => !value)}
        aria-label="Open notifications"
      >
        Alerts
        {unreadCount ? <span className="absolute -right-2 -top-2 min-w-5 rounded-full bg-rose-600 px-1.5 py-0.5 text-xs text-white">{unreadCount > 99 ? "99+" : unreadCount}</span> : null}
      </button>

      {isOpen ? (
        <section className="absolute right-0 mt-2 w-[min(23rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
          <header className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <div>
              <h2 className="font-bold text-slate-900">Notifications</h2>
              <p className="text-xs text-slate-500">Task updates for you</p>
            </div>
            <button className="text-xs font-bold text-blue-800 disabled:text-slate-400" onClick={markAllRead} disabled={!unreadCount}>Mark all read</button>
          </header>
          <div className="max-h-96 overflow-y-auto">
            {notifications.length ? notifications.map((item) => (
              <button
                key={item.id}
                className={`block w-full border-b border-slate-100 px-4 py-3 text-left transition hover:bg-blue-50 ${item.is_read ? "bg-white" : "bg-blue-50/60"}`}
                onClick={() => {
                  setIsOpen(false);
                  navigate(`/task/${item.task}`);
                }}
              >
                <p className="text-sm font-medium text-slate-800">{item.message}</p>
                <p className="mt-1 text-xs text-slate-500">{item.created_at ? new Date(item.created_at).toLocaleString() : ""}</p>
              </button>
            )) : <p className="p-5 text-sm text-slate-500">You are all caught up.</p>}
          </div>
        </section>
      ) : null}
      </div>
    </div>
  );
}
